var format = require('util').format;

module.exports = {
    USER: '/user',
    ownerAccessKey: '/user/%d/accesskey',
    CURRENT_ACCESS_KEY: '/user/current/accesskey',

    setOwnerId: function (ownerId) {
        this.ownerAccessKey = format(this.ownerAccessKey, ownerId);
    },

    get: function (path, id) {
        return [path, id].join('/');
    }
}