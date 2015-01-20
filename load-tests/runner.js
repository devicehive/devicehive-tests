var NotifTest = require('./notif-test.js');
var utils = require('../common/utils.js');

var app = {
    start: function () {
        var test = new NotifTest(
            utils.getConfig('devices'),
            utils.getConfig('notifications'), 
            utils.getConfig('intervalMillis'));

        test.run();
    },
};

app.start();
