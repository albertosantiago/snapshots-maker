var fs   = require('fs');
var Logger  = require('./util.js').Logger;
var PhantomBuilder = require('phantom');

var logger = null;

var PhantomCluster = function (options) {
    this.debug = options.debug;
    logger = new Logger(options.debug);
    this.cluster = [];
    this.instanceNumber = 0;
    this.allowedDomains = options.allowedDomains;
    this.resourceHandler = this.generateResourceHandler();
    var self = this;
    setInterval(function(){
        self.checkCluster();
    }, 5000);
    this.generateResourceHandler();
};


PhantomCluster.prototype.getPage = function(){
    logger.info("Getting page...");
    var self = this;
    return new Promise(function(resolve, reject){
        if(self.instanceNumber>0){
            var instanceKey = self.getWorkingInstanceKey();
            if(!instanceKey){
                self.addPhantomInstance().then(function(){
                    var instanceKey = self.getWorkingInstanceKey();
                    if(instanceKey){
                        self.setPage(instanceKey).then(function(page){
                            resolve(page);
                        },function(){
                            reject();
                        });
                    }else{
                        reject();
                    }
                });
            }
            self.setPage(instanceKey).then(function(page){
                resolve(page);
            },function(){
                reject();
            });
        }else{
            self.addPhantomInstance().then(function(instanceKey){
                self.setPage(instanceKey).then(function(page){
                    resolve(page);
                },function(){
                    reject();
                });
            });
        }
    });
};

PhantomCluster.prototype.setPage = function(instanceKey){
    var self = this;
    var page = null;
    logger.info("Creating and setting page object...");
    return new Promise(function (resolve, reject){
        let phantomInstance = self.getPhantomInstanceByKey(instanceKey).instance;
        return phantomInstance.createPage().then(
        	function(auxPage){
		        logger.info("Page created: OK.");
		        logger.info("Configuring page object...");
		        page = auxPage;
		        page.setting('userAgent', 'Snapshot-Maker');
		        page.setting('loadImages', false);

                page.property('onResourceRequested', self.resourceHandler);
		        page.property('onClosing', function(page) {
		            console.log('***********************************');
		            console.log('Closing page...');
		            console.log('***********************************');
		        });
		        if(self.debug){
		            page.property('onResourceReceived', function(response) {
		                console.log('Response (#' + response.id + ', stage "' + response.stage + '"): ' + JSON.stringify(response.url));
		            });
		            page.property('onResourceError' , function(resourceError) {
		                console.log('Unable to load resource (#' + resourceError.id + 'URL:' + resourceError.url + ')');
		                console.log('Error code: ' + resourceError.errorCode + '. Description: ' + resourceError.errorString);
		            });
		        }
		        logger.info("Page configured: OK");
		        resolve(page);
        },
        function(e){
        	logger.info("Error creating page object...");
        	logger.info(e);
            logger.info("Refreshing Phantom instance...");
            self.removePhantomInstance(instanceKey).then(function(){
                self.addPhantomInstance().then(function(){
                    logger.info("Rejecting request...");
                    reject();
                });
            });
        });
    });
};

PhantomCluster.prototype.addPhantomInstance = function(){
    var self = this;
    return new Promise(function (resolve, reject){
        PhantomBuilder.create().then(function(instance){
            logger.info("New Phantom instance created.");
            var d   = new Date();
            var key = "PH_IN_" + self.cluster.length + "_" + d.getMilliseconds();
            var phantomInstance = {
                key: key,
                instance: instance,
                pages: [],
                total_requests: 0
            };
            self.cluster.push(phantomInstance);
            self.instanceNumber++;
            resolve(true);
        });
    });
};

PhantomCluster.prototype.removePhantomInstance = function(instanceKey){
    logger.info("Removing Phantom instance: " + instanceKey);
    var self = this;
    return new Promise(
        function (resolve, reject){
            logger.info("Killing Phantom instance...");
            var phantomInstance = self.getPhantomInstanceByKey(instanceKey);
            if(self.isWorkingInstance(phantomInstance)){
                setTimeout(function(){
                    logger.info("Exiting instance...");
                    phantomInstance.instance.exit(0);
                }, 12000);
            }
            logger.info("Deleting instance from cluster...");
            for(var i=0; i<self.cluster.length;i++){
                auxInst = self.cluster[i];
                logger.info("Looking for: " + instanceKey + " - Comparing with:" + auxInst.key);
                if(auxInst.key === instanceKey){
                    logger.info(auxInst.key + " found, trying to deleting.");
                    self.cluster.splice(i,1);
                    logger.info("Instance " + auxInst.key + " deleted.");
                    break;
                }
            }
            self.instanceNumber--;
            logger.info("Done :]");
            resolve(true);
        }
    );
};

PhantomCluster.prototype.getPhantomInstanceByKey = function(key){
    for(indexInstance in this.cluster){
        var phantomInstance = this.cluster[indexInstance];
        if(phantomInstance.key === key){
            return phantomInstance;
        }
    }
};

PhantomCluster.prototype.getWorkingInstanceKey = function(){
    for(indexInstance in this.cluster){
        var phantomInstance = this.cluster[indexInstance];
        if(this.isWorkingInstance(phantomInstance)){
            this.cluster[indexInstance]['total_requests'] += 1;
            return phantomInstance.key;
        }
    }
    return false;
};

PhantomCluster.prototype.generateResourceHandler = function(){
    var allowedDomains = this.allowedDomains;
    var funcBody = "var parser = document.createElement('a'); \
                    parser.href = requestData['url'];";

    funcBody += "if ((/.*\\.css|.*\\.png|.*\\.jpg|.*\\.gif/gi).test(requestData['url'])) { \
                    console.log('The url of the request is matching. Aborting: ' + requestData['url']); \
                    request.abort();\
                    return; \
                }\
                if ((/googleapis\\.com|google-analytics.com/gi).test(requestData['url'])) { \
                    request.abort(); \
                    console.log('The url of the request is matching. Aborting: ' + requestData['url']); \
                    return; \
                }";

    funcBody += "var allowedDomains = " + JSON.stringify(allowedDomains) + ";";
    funcBody += "if(allowedDomains.indexOf(parser.hostname)===-1){ \
        request.abort(); \
        console.log('The url of the request is matching. Aborting: ' + requestData['url']); \
        return; \
    }";
    funcBody += "console.log('Requesting:' + requestData['url']);";
    return new Function('requestData', 'request', funcBody);
}

PhantomCluster.prototype.isWorkingInstance = function(phantomInstance){
    logger.info("checking instance " + phantomInstance.key + "...");
    if(phantomInstance.instance.process.killed){
        logger.info("Instance KO (killed=true). :[");
        return false;
    };
    try{
        var path = "/proc/" + phantomInstance.instance.process.pid;
        var stats = fs.statSync(path);
        logger.info("Instance OK. :]");
        return true;
    }catch(e){
        logger.info("Instance KO (Process not found). :[");
        return false;
    }
};

PhantomCluster.prototype.checkCluster = function(){
    logger.info("Checking health cluster...");
    for(var index in this.cluster){
        var phantomInstance = this.cluster[index];
        if(!this.isWorkingInstance(phantomInstance)){
            logger.info("Phantom instance discconected, removing instance...");
            this.removePhantomInstance(phantomInstance.key);
        }
        if(this.cluster[index].total_requests>25){
            logger.info("Phantom instance used more than 25 times, removing instance.");
            this.removePhantomInstance(phantomInstance.key);
        }
    }
    logger.info("Cluster size: " + this.cluster.length);
    if(this.cluster.length==0){
        logger.info("Zero instances found, creating one.")
        this.addPhantomInstance();
    }
    return;
};

module.exports = PhantomCluster;
