var 
    debug = require("debug")
    , debugAWS = debug("AWS")
    , AWS = require("aws-sdk")
    , async = require("async")
    , _ = require("lodash")
; 

module.exports = function(ACCESS_KEY, SECRET_KEY, moduleCB) {
    AWS.config.apiVersions = { ec2: '2013-08-15'};

    async.auto({
        'regions': function(cb) {
            debugAWS("Fetching Regions");

            var ec2 = new AWS.EC2({region:'us-east-1', accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY});
            ec2.describeRegions({}, function(err, data) {
                if (err) {
                    return cb(err);
                }

                var regions = [];
                for(var r=0; r<data.Regions.length; r++) {
                    regions.push(data.Regions[r].RegionName);
                }
                cb(null, regions);
            });
        }
        , instances: ['regions', function(topCB, results) {
            var jobs = [];
            results.regions.forEach(function(region) {
                jobs.push(function(jobCB) {
                    var ec2 = new AWS.EC2({region:region, accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY});
                    var params = { Filters: [ {Name: "instance-state-name", Values: ["running"]} ]};

                    ec2.describeInstances(params, function(err, data) {
                        var instances = {};

                        if (err) {
                            return cb(err);
                        }

                        if (data.Reservations.length > 0) {
                            for(var r=0; r<data.Reservations.length; r++) {
                                var res = data.Reservations[r];
                                for (var i=0; i<res.Instances.length; i++) {
                                    if (!res.Instances[i].PublicDnsName) continue;
                                    // todo, handle things in VPCs w/out public IP cnames
                                    
                                    instances[res.Instances[i].InstanceId] = res.Instances[i].PublicDnsName;
                                }
                            }
                        } 

                        jobCB(null, instances);
                    });
                });
            });

            // fetch all the instances in all regions in parallel
            async.parallel(jobs, function(err, instResults) {
                if (err) { return topCB(err); }

                var allInstances = {};
                instResults.forEach(function(r) { _.merge(allInstances, r)});
                topCB(null, allInstances);

            });
        }]
    }, function(err, results) {
        if (err) return moduleCB(err);
        moduleCB(null, results.instances);
    });
};
