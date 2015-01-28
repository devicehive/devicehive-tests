var utils = require('./utils.js');
var isDebug = utils.getConfig('log:level') === 'DEBUG';

module.exports = {

    debug: function () {

        if (!isDebug) {
            return;
        }

        console.log.apply(this, arguments);
    },

    info: function () {
        console.log.apply(this, arguments);
    },

    error: function () {
        console.log.apply(this, arguments);
    }
}