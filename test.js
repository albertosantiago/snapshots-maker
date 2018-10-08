var page   = require('webpage').create();
var server = require('webserver').create();
var fs     = require('fs');

var url = "http://pornolistas.es.local/player/7569005";

var log = function(msg){
    console.log(msg);
};

page.settings.userAgent = 'googlebot';

page.onResourceReceived = function(response) {
    log('Response (#' + response.id + ', stage "' + response.stage + '"): ' + JSON.stringify(response.url));
};

page.onResourceRequested = function(requestData, request) {
    if ((/.*\.css|.*\.png|.*\.jpg|.*\.gif/gi).test(requestData['url']) || requestData['Content-Type'] == 'text/css') {
        request.abort();
        log('The url of the request is matching. Aborting: ' + requestData['url']);
    }else if ((/googleapis\.com|google-analytics.com/gi).test(requestData['url']) ||                    requestData['Content-Type'] == 'image/png') {
        request.abort();
            log('The url of the request is matching. Aborting: ' + requestData['url']);
    }else{
        log('Requesting:' + requestData['url']);
    }
};


page.open(genUrl,
    function(){
        log(page.content);
    }
);
