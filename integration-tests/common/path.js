var format = require('util').format;
var qs = require('querystring');

var path = {
    current: null,

    USER: '/user',
    CURRENT: '/current',
    CURRENT_ACCESS_KEY: '/user/current/accesskey',
    JWT: '/token',
    NETWORK: '/network',
    DEVICE_TYPE: '/devicetype',
    INFO: '/info',
    INFO_CACHE: '/info/cache',
    HEALTH: '/health',
    DEVICE: '/device',
    CONFIGURATION: '/configuration',
    PLUGIN_REGISTER: '/plugin',
    NOTIFICATION: {
        get: function (deviceId) {
            return path.combine(path.DEVICE, deviceId, 'notification');
        },
        poll: function () {
            return path.combine(path.DEVICE, 'notification', path.POLL);
        }
    },
    COMMAND: {
        get: function (deviceId) {
            return path.combine(path.DEVICE, deviceId, 'command');
        },
        poll: function () {
            return path.combine(path.DEVICE, 'command', path.POLL);
        }
    },
    POLL: '/poll',
    COUNT: '/count',

    get: function (path, id, query) {

        if (id) {
            path = [path, id].join('/');
        }

        if (query) {
            path += '?' + qs.stringify(query);
        }

        return path;
    },

    combine: function () {
        var args = Array.prototype.slice.call(arguments);
        return args.join('/').replace(new RegExp('//', 'g'), '/');
    },

    query: function () {
        var query = {};
        var args = Array.prototype.slice.call(arguments);
        for (var i = 0; i < args.length; i += 2) {
            query[args[i]] = args[i + 1];
        }
        return query;
    }
};

module.exports = path;