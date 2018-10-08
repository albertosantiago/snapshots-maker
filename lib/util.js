"use strict";
var fs   = require('fs');

exports.Logger = function(enable){
    this.enable = enable;
};

exports.Logger.prototype.info = function(msg){
    if(this.enable){
        console.log(msg);
    }
};

exports.getParameterByName = function(name, url){
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
};

exports.writeCacheSegments = function(base,segments){
	var finalPath = base,
		i = 0,
		total = segments.length;
	for(i;i<total;i++){
		finalPath += "/"+segments[i];
	}
	try{
		var stat = fs.statSync(finalPath);
	}catch(e){
		var path = base;
		for(i=0;i<total;i++){
			path += "/"+segments[i];
			try{
				fs.mkdirSync(path);
			}catch(e){}
		}
		return true;
	}
	return true;	
};
