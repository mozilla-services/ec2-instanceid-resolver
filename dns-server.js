#!/usr/bin/env node

var debug = require('debug')
    , debugInfo = debug("INFO")
    , debugDNS = debug("DNS")
    , debugCache = debug('cache')
    , fetchInstances = require('./libs/aws.js')
    , dns = require('native-dns')
    , server = dns.createServer()
    , program = require('commander')
    , config = require('./libs/config')
    , fs = require('fs')
    , async = require('async')
    , _ = require('lodash')
    , INSTANCE_CACHE = {}
    ;

program
    .version('0.0.1')
    .option('-c, --config [file]', 'Config file to use')
    .parse(process.argv);

if (program.config && fs.existsSync(program.config)) {
    config.loadFile(program.config);
} else {
    console.error("Config file required");
    process.exit();
}

server.on('request', function(req, res) {
    var name = req.question[0].name, 
        instanceId = name.split('.')[0];

    debugDNS("Got request for %s => %s", name, instanceId);

    if (INSTANCE_CACHE[instanceId]) {
        res.answer.push(dns.CNAME({
            name: name
            , data: INSTANCE_CACHE[instanceId]
            , ttl: 60
        }));
    } else {
        res.answer.push(dns.CNAME({
            name: name
            , data : ""
            , ttl: 60
        }));
    }

    res.send();
});

server.on('error', function(err, buff, req, res) {
    console.log(err.stack);
});
server.on('socketError', function(err, socket) {
    console.log("Socket Error", err);
});

server.on('listening', function() {
    console.log("Listening on " + this.address().address + ":" + this.address().port);
});

server.serve(config.get('port'));

/** 
 * Update INSTANCE_CACHE 
 */
(function updateCache() {
    debugInfo("Updating EC2 hostname cache...");
    getAllInstances(config.get("accounts"), function(err, allInstances) {
        if (err) {
            console.error("Error: ", err);
            return;
        }

        INSTANCE_CACHE = allInstances;
        debugInfo("Instance Cache updated with %d entries", Object.keys(INSTANCE_CACHE).length);

        // do it again..
        setTimeout(updateCache, config.get("refreshInterval"));
    });
})();

function getAllInstances(accounts, topCB) {
    var fetchers = [ ];
    debugInfo("Fetching all EC2 Instances in all configured accounts...")
    accounts.forEach(function(account) {
        fetchers.push(function(asyncCB) {
            fetchInstances(account.accessKey, account.accessSecret, asyncCB)
        });
    });

    async.parallel(fetchers, function(err, results) {
        if (err) { return topCB(err); }

        var _tmp = {};
        results.forEach(function(data) {
            _.merge(_tmp, data);
        });

        topCB(null, _tmp);
    });
}
