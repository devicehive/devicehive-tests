var format = require('util').format;

module.exports = {
    USER: '/user',
    ownerAccessKey: '/user/%d/accesskey',
    CURRENT_ACCESS_KEY: '/user/current/accesskey',
    NETWORK: '/network',

    setOwnerId: function (ownerId) {
        this.ownerAccessKey = format(this.ownerAccessKey, ownerId);
    },

    get: function (path, id) {
        return [path, id].join('/');
    },

    combine: function () {
        var args = Array.prototype.slice.call(arguments);
        return args.join('/').replace('//', '/');
    }
}