var config = require('nconf').argv().env().file({
    file: require('path').resolve(__dirname, '../config.json')
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