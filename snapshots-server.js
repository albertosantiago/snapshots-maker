"use strict";
var http = require('http');
var fs   = require('fs');
var md5  = require('md5');
var Logger  = require('./lib/util.js').Logger;
var getParameterByName  = require('./lib/util.js').getParameterByName;
var writeCacheSegments  = require('./lib/util.js').writeCacheSegments;
var PhantomCluster = require('./lib/phantom-cluster.js');
var SnapshotsAdmin = require('./lib/snapshots-admin.js');

/**
info: Requesting:http://xhamster.com/xembed.php?video=6236551
info: The url of the request is matching. Aborting: http://static-ec.xhcdn.com/id26/css/player/layout.css
info: Requesting:http://static-ec.xhcdn.com/js/xplayer/xplayer.embed.js?_=1472735887526
info: Requesting:https://s7.addthis.com/js/300/addthis_widget.js?pubid=xhamster&_=1472735887527
info: Requesting:http://xhamster.com/api/flash.php?/video/info&video_id=6236551&nogfy
info: Requesting:http://m.addthis.com/live/red_lojson/300lo.json?si=57c82a8fd5854e0d&bl=1&sid=57c82a8fd5854e0d&pub=xhamster&rev=v7.5.1-wp&ln=en&pc=men&cb=0&ab=-&dp=xhamster.com&dr=pornolijsten.com&fp=movies%2F6236551%2Flecherous_hairy_lesbian_licked_by_shaved_teenie.html&fr=&of=0&pd=0&irt=1&vcl=2&md=2&ct=1&tct=0&abt=0&cdn=0&lnlc=US&pi=1&rb=4&gen=100&chr=UTF-8&colc=1472735887844&jsl=1&uvs=57c8257fa32948a408a&skipb=1&callback=addthis.cbs.oln9_138229673961177470
info: Requesting:http://s7.addthis.com/static/sh.70a42bd59f68e6caa20cf9f5.html#rand=0.1748251465614885&iit=1472735887836&tmr=load%3D1472735887788%26core%3D1472735887811%26main%3D1472735887831%26ifr%3D1472735887842&cb=0&cdn=0&md=2&kw=&ab=-&dh=xhamster.com&dr=http%3A%2F%2Fpornolijsten.com%2F&du=http%3A%2F%2Fxhamster.com%2Fmovies%2F6236551%2Flecherous_hairy_lesbian_licked_by_shaved_teenie.html&href=http%3A%2F%2Fxhamster.com%2Fxembed.php&dt=Video%3A%20Lecherous%20hairy%20lesbian%20licked%20by%20shaved%20teenie&dbg=0&cap=tc%3D0%26ab%3D0&inst=1&jsl=1&prod=undefined&lng=en-US&ogt=&pc=men&pub=xhamster&ssl=0&sid=57c82a8fd5854e0d&srpl=1&srf=0.01&srx=1&ver=300&xck=0&xtr=0&og=&csi=undefined&rev=v7.5.1-wp&ct=1&xld=1&xd=1
**/

const PORT = 3000;
const ADMIN_PORT = 3001;

var phantomCluster = null;
var server  = null;
var serverAdmin = null;

var snpConfig = JSON.parse(fs.readFileSync('snpm.config.json'));
var env       = snpConfig.env;
snpConfig = snpConfig[env];

process.chdir(snpConfig.basePath);
var logger = new Logger(snpConfig.debug);

var initServers = function(){
    logger.info("Initializating snapshots server...");
    server = http.createServer(handleRequest);
    server.listen(PORT, function(){
        logger.info("Server listening on: http://localhost:"+PORT);
    });
    if(snpConfig.adminServerEnabled){
        logger.info("Initializating admin server...");
        serverAdmin = new SnapshotsAdmin({
            port : ADMIN_PORT,
            dbPath: snpConfig.dbPath,
            debug: snpConfig.debug
        });
    }
};

var handleRequest = function(request, response){

    logger.info("Handling request...");
    response.statusCode = 200;
	var url = decodeURIComponent(getParameterByName('url', request.url));
    logger.info("Request url: " + url);

    var fileHash = md5(url);
    var cacheSegments = [];

    if(snpConfig.cacheEnabled){
        logger.info("Writting Cache Directory Path...");
        cacheSegments.push(fileHash.substring(0,1));
        cacheSegments.push(fileHash.substring(1,2));
        cacheSegments.push(fileHash.substring(2,4));
        writeCacheSegments('snapshots', cacheSegments);
    }else{
        logger.info("Cache Disabled - Skipping directory structure creation");
    }

    var cacheFile = 'snapshots/'+ cacheSegments[0] + '/' + cacheSegments[1] + '/' + cacheSegments[2] + '/' +  md5(url);

    if(snpConfig.cacheEnabled){

        logger.info("Request Cache File: "   + cacheFile);
        logger.info("Trying recovering cache file...");

    	try {
    		let stat = fs.statSync(cacheFile);
    		if(stat.isFile()){
    		    var now = new Date().getTime();
    		    //35 horas de cache.
    		    var expireDate = stat.ctime.getTime() + ((1000*60*60*35));
    		    if(expireDate > now){
    		        logger.info("Returning cached file.");
    		        response.write(fs.readFileSync(cacheFile));
    		        response.end();
    		        return;
    		    }
    		}
    	} catch (e) {
    		logger.info("Failed recovering cached file...");
    		if(e.errno!==-2){
    		    logger.info(e);
    		}
    	}
    }else{
        logger.info("Cache disabled - Skipping cache recovering");
    }

    logger.info("Recovering page from server...");
    phantomCluster.getPage().then(function(page){
        logger.info("Page object ready, processing request...");
        processRequest(page, url).then(
        	function(content){
                if(snpConfig.cacheEnabled){
                	logger.info("Writting cache to disk.");
		            fs.writeFileSync(cacheFile, content);
                }else{
                    logger.info("Cache disabled - Skipping cache writting.");
		        }
                logger.info('Sending response...');
                response.headers = {"Cache": "no-cache", "Content-Type": "text/html"};
                response.write(content);
                response.end();
                //Important!! Close page after use.
                page.close();
                logger.info('Done! :]');
                return;
        	},
        	function(){
                logger.info("Failed rendering page...");
                response.statusCode = 500;
                response.end();
                //Important!! Close page after use.
                page.close();
                return;
       		}
       	);
    }, function(){
        logger.info("Failed creating Page Object, sending 500 error...");
        response.statusCode = 500;
        response.end();
    });
};

var processRequest = function(page, url){
    var counterRender = 0;
    return new Promise(function(resolve, reject){
		var crawler = function(status) {
		    logger.info("Response Status:" + status);
		    var checkLoad = function(){
		        page.evaluate(function() {
		            var meta = document.querySelector("meta[name=rendered]");
		            if(meta){
		                if(meta.getAttribute('content')==="ok"){
		                    var catBox = document.querySelector('.categories-box-comp');
		                    if(catBox){
		                        var items = catBox.querySelector('.categories-item-comp');
		                        if(items){
		                            return true;
		                        }else{
		                            return false;
		                        }
		                    }else{
		                        return true;
		                    }
		                }
		            }else{
		                return false;
		            }
		        }).then(
		        	function(ret){
				        var rendered = ret;
				        logger.info("Rendered status:"+rendered);
				        if(rendered){
				            //Eliminamos los js, antes de continuar.
				            logger.info("Cleaning scripts tags...");
				            page.evaluate(function(){
				                var scripts = document.getElementsByTagName("script");
				                var total   = scripts.length,
				                    i = 0;
				                if(total!==undefined){
				                    while(scripts.length>0){
				                        scripts[0].remove();
				                    }
				                }
				                return total;
				            }).then(
				            	function(){
				                	page.property('content').then(
				                		function(content){
				                		    resolve(content);
				                		},
				                		function(e){
								   			logger.info("Whoops something failed...");
											logger.info(e);
											reject();
								   		}
				                	);
				           		},
				           		function(e){
				           			logger.info("Whoops something failed...");
									logger.info(e);
									reject();
				           		}
				           	);
				        }else{
				            counterRender++;
				            logger.info(counterRender + "º attemp failed.");
				            logger.info("Retry again in 150 mms...");
				            if(counterRender>snpConfig.maxRenderAttemps){
								reject();
				            }else{
				                setTimeout(checkLoad, 150);
				            }
						}
		        	},
				    function(e){
				        logger.info("Whoops something failed...");
				    	logger.info(e);
				    	reject();
				    }
				);
		    };
		    if(status === "success") {
		        logger.info("Checking JS execution...");
		        checkLoad();
		    }else{
		        logger.info("Whoops something failed...");
		        logger.info("Status:" + status);
                reject();
		    }
		};
		if(url){
		    logger.info("Opening page: " + url);
		    page.open(url).then(crawler);
		}else{
			logger.info("URL not valid:" + url);
		    reject();
		}
	});
};

logger.info("\nStarting service...");
logger.info("Starting phantom cluster...");
phantomCluster = new PhantomCluster({
    debug: snpConfig.debug,
    allowedDomains: snpConfig.allowedDomains,
});
initServers();
