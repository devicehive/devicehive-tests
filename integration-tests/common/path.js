var format = require('util').format;
var qs = require('querystring');

var path = {
    current: null,

    USER: '/user',
    CURRENT: '/current',
    CURRENT_ACCESS_KEY: '/user/current/accesskey',
    JWT: '/token',
    NETWORK: '/network',
    INFO: '/info',
    DEVICE: '/device',
    DEVICE_CLASS: '/device/class',
    CONFIGURATION: '/configuration',
    NOTIFICATION: {
        get: function (deviceGuid) {
            return path.combine(path.DEVICE, deviceGuid, 'notification');
        },
        poll: function () {
            return path.combine(path.DEVICE, 'notification', path.POLL);
        }
    },
    COMMAND: {
        get: function (deviceGuid) {
            return path.combine(path.DEVICE, deviceGuid, 'command');
        },
        poll: function () {
            return path.combine(path.DEVICE, 'command', path.POLL);
        }
    },
    POLL: '/poll',

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