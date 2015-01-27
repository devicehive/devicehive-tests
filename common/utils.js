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
    },

    clone: function (obj) {
        
        var self = this;

        if (obj == null || typeof (obj) != 'object')
            return obj;

        var copy = obj.constructor();
        var keys = Object.keys(obj);
        keys.forEach(function (key) { 
            copy[key] = self.clone(obj[key]);
        });

        return copy;
    }
}