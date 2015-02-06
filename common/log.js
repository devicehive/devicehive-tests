var utils = require('./utils.js');
var isDebug = utils.getConfig('log:level') === 'DEBUG';
var isSummary = utils.getConfig('log:level') === 'SUMMARY';

module.exports = {

    debug: function () {

        if (!isDebug) {
            return;
        }

        console.log.apply(this, arguments);
    },

    info: function () {

        if (isSummary) {
            return;
        }

        console.log.apply(this, arguments);
    },

    summary: function () {

        if (!isSummary) {
            return;
        }

        console.log.apply(this, arguments);
    },

    error: function () {
        console.log.apply(this, arguments);
    }
}