var NotifTest = require('./notif-test.js');
var CommandTest = require('./cmnd-test.js');
var utils = require('../common/utils.js');

var app = {
    
    start: function () {

        //var cmndTest = new CommandTest(
        //    utils.getConfig('cmndTest:clients'),
        //    utils.getConfig('cmndTest:commands'), 
        //    utils.getConfig('cmndTest:intervalMillis'));
        
        //this.tests = [cmndTest];

        //this.tests.forEach(function (test) {
        //    test.run();
        //});

        utils.getConfig('notifTest:groups').forEach(function (config) {
            var notifTest = new NotifTest();
            notifTest.clientsCount = config.clients;
            notifTest.devicesCount = config.devices;
            notifTest.notifCount = config.notifsPerDevice;
            notifTest.intervalMillis = config.intervalMillis;
            notifTest.deviceGuids = config.deviceGuids;
            notifTest.names = config.notifications;
            notifTest.run();
        });
    },
};

app.start();
