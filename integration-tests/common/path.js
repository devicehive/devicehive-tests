var format = require('util').format;

function Query() {
    this.params = {};
}

Query.prototype = {
    add: function (key, value) {
        this.params[key] = value;
        return this;
    },

    build: function () {
        var self = this;
        var keys = Object.keys(this.params);
        var kv = keys.map(function (key) {
            return format('%s=%s', key, self.params[key]);
        });
        return '?' + kv.join('&');
    }
}

var path = {
    current: null,

    USER: '/user',
    CURRENT_ACCESS_KEY: '/user/current/accesskey',
    NETWORK: '/network',
    INFO: '/info',
    DEVICE: '/device',
    DEVICE_CLASS: '/device/class',
    NOTIFICATION: {
        get: function (deviceGuid) {
            return path.combine(path.DEVICE, deviceGuid, 'notification');
        }
    },

    get: function (path, id, query) {

        if (id) {
            path = [path, id].join('/');
        }

        if (query) {
            path += query.build();
        }

        return path;
    },

    combine: function () {
        var args = Array.prototype.slice.call(arguments);
        return args.join('/').replace('//', '/');
    },

    query: function () {
        var query = new Query();
        var args = Array.prototype.slice.call(arguments);
        for (var i = 0; i < args.length; i += 2) {
            query.add(args[i], args[i + 1]);
        }
        return query;
    }
};

module.exports = path;