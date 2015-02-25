var format = require('util').format;

module.exports = {
    USER: '/user',
    userAccessKey: '/user/%d/accesskey',
    CURRENT_ACCESS_KEY: '/user/current/accesskey',
    NETWORK: '/network',

    setUserId: function (userId) {
        this.userAccessKey = format(this.userAccessKey, userId);
    },

    get: function (path, id) {
        return [path, id].join('/');
    },

    combine: function () {
        var args = Array.prototype.slice.call(arguments);
        return args.join('/').replace('//', '/');
    }
}