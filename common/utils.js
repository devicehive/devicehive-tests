var config = require('nconf').argv().env().file({
    file: './config.json'
});

var requestId = 1;

module.exports = {
    getRequestId: function () { 
        return requestId++;
    },

    getConfig: function (key) {
        return config.get(key);
    }
}