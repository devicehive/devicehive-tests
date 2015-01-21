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

        this.tests.forEach(function (test) {
            test.ondone = app.ontestdone;
            test.run();
        });
    },

    ontestdone: function () {
        if (++app.testsDone < app.tests.length) {
            return;
        }
        
        setTimeout(function () {
            process.exit();
        }, 5000);
        //process.exit();
    }
};

app.start();
