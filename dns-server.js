#!/usr/bin/env node

var debug = require('debug')
    , debugInfo = debug("INFO")
    , debugDNS = debug("DNS")
    , fetchInstances = require('./libs/aws.js')
    , dns = require('native-dns')
    , server = dns.createServer()
    INSTANCE_CACHE = {}
    ;


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
            , ttl: 60
        }));
    }

    res.send();
});

server.on('error', function(err, buff, req, res) {
    console.log(err.stack);
});

server.on('listening', function() {
    console.log("Listening on " + this.address().address + ":" + this.address().port);
});

fetchInstances(process.env.AWS_ACCESS_KEY, process.env.AWS_SECRET_KEY, function(err, results) {
    if (err) {
        console.log(err);
        process.exit();
    }

    INSTANCE_CACHE = results;
    Object.keys(INSTANCE_CACHE).forEach(function(instanceId) {
        debugInfo("InstanceId: %s => %s", instanceId, INSTANCE_CACHE[instanceId]);
    });

    server.serve(15353);
});


