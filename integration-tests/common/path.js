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

    get: function (path, id) {
        if (!id) {
            return path;
        }

        return [path, id].join('/');
    },

    combine: function () {
        var args = Array.prototype.slice.call(arguments);
        return args.join('/').replace('//', '/');
    }
};

module.exports = path;