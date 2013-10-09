var convict = require('convict');

var conf = convict({
    refreshInterval: {
        doc: "EC2 hostname cache refresh interval in ms"
        , default: 60000
    }
    , port : {
        doc: "Port to run DNS server on"
        , default: 53
    }
    , accounts: {
        doc: "An array of AWS accounts."
        , default: []
    }
});

module.exports = conf;
