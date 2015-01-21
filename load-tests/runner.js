var NotifTest = require('./notif-test.js');
var CommandTest = require('./cmnd-test.js');
var utils = require('../common/utils.js');

var app = {
    
    testsDone: 0,

    start: function () {

        var notifTest = new NotifTest(
            utils.getConfig('notifTest:devices'),
            utils.getConfig('notifTest:notifications'), 
            utils.getConfig('notifTest:intervalMillis'));

        var cmndTest = new CommandTest(
            utils.getConfig('cmndTest:devices'),
            utils.getConfig('cmndTest:commands'), 
            utils.getConfig('cmndTest:intervalMillis'));
        
        this.tests = [notifTest, cmndTest];
        //this.tests = [notifTest];

        this.tests.forEach(function (test) {
            test.run();
        });
    },
};

app.start();
