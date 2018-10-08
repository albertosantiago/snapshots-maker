"use strict";
var sqlite3 = require('sqlite3').verbose();
var http    = require('http');
var Logger     = require('./util.js').Logger;
var getParamByName  = require('./util.js').getParameterByName;

var logger = null;

var SnapshotsAdmin = function(options){
    logger = new Logger(options.debug);
    this.dbPath = options.dbPath;
    var self = this;
    this.server = http.createServer(function(request, response){
        self.handleRequest(request, response);
    });
    this.server.listen(options.port, function(){
        logger.info("Admin Server listening on: http://localhost:" + options.port);
    });

};

SnapshotsAdmin.prototype.handleRequest = function(request, response){
    logger.info("Admin: Requesting Report.");
    var self = this;
    this.db  = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READONLY);
    response.write('<html><head>');
    response.write('<style>*{font-size:1em;font-family:Ubuntu,Arial;}h1{font-size:2em;}h2{font-size:1.4em;}');
    response.write('table td{padding:10px;}body{padding:20px;}</style>');
    response.write('</head><body><h1>Snapshots Report</h1>');
    response.write('<h2>Sitemaps</h2><table>');
    this.getSitemapsInfo().then(function(content){
        response.write(content);
        response.write('</table>');
        response.write("<h2>URLs Info</h2>");
        response.write('<table>');
        response.write('<tr><th>URL</th><th>Domain</th><th>Size</th><th>Prev Size</th><th>Last Modification</th><th>Working</th><th>Working Since</th></tr>');
        self.getUrlsInfo().then(function(content){
            response.write(content);
            response.write('</table>');
            response.write('</body></html>');
            self.db.close();
            response.end();
            logger.info("Admin: Request finished.");
        });
    });
};

SnapshotsAdmin.prototype.getSitemapsInfo = function(){
    var buffer = "";
    var self = this;
    return new Promise(function(resolve, reject){
        self.db.serialize(function(){
            self.db.each("SELECT * FROM sitemaps",
                function(err, row){
                    logger.info(row);
                    buffer += "<tr><td>"+row.domain+"</td><td>"+row.updatedAt+"</td></tr>";
                },
                function(){
                    logger.info("Admin: Sitemaps info completed, resolving promise.");
                    resolve(buffer);
                }
            );
        });
    });
};

SnapshotsAdmin.prototype.getUrlsInfo = function(){
    var buffer = "";
    var self = this;
    return new Promise(function(resolve, reject){
        self.db.serialize(function(){
            self.db.each("SELECT * FROM urls ORDER BY last_snapshot DESC",
                function(err, row){
                    logger.info(row);
                    buffer += "<tr><td>"+row.url+"</td><td>"+row.domain+"</td>";
                    buffer += "<td>"+(0+row.cache_size)+"B</td><td>"+(0+row.prev_cache_size)+"B</td>";
                    buffer += "<td>"+row.last_snapshot+"</td><td>"+row.work_in_progress+"</td><td>"+row.working_since+"</td></tr>";
                },
                function(){
                    resolve(buffer);
                }
            );
        });
    });
};

module.exports = SnapshotsAdmin;
