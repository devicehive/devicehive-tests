var async = require('async');
var NotifTest = require('./notif-test.js');
var CommandTest = require('./cmnd-test.js');
var utils = require('../common/utils.js');

var fs = require('fs');
var path = require('path');
var LOG_PATH = path.join(__dirname, 'load-tests-notif.txt');

var app = {
    
    start: function () {
        async.eachSeries(
            utils.getConfig('notifTest:groups'), 
            app.startNotifTest, app.onNotifTestComplete);
    },
    
    startNotifTest: function (config, callback) {
        var notifTest = new NotifTest();
        notifTest.clientsCount = config.clients;
        notifTest.devicesCount = config.devices;
        notifTest.notifCount = config.notifsPerDevice;
        notifTest.intervalMillis = config.intervalMillis;
        notifTest.deviceGuids = config.deviceGuids;
        notifTest.names = config.notifications;
        notifTest.run(function (err, result) {
            app.saveResult(result);
            app.showResult(result);
            callback(err);
        });
    },

    saveResult: function (result) {
        var stream = fs.createWriteStream(LOG_PATH, { flags: 'a' });
        stream.write(JSON.stringify(result) + '\n');
    },
    
    showResult: function (result) {
        console.log('--------------------------------------');
        console.log('start: %s', result.start);
        console.log('end: %s', result.end);
        console.log('clients: %s', result.clients);
        console.log('devices: %s', result.devices);
        console.log('notifications per device: %s', result.notifsPerDevice);
        console.log('interval, millis: %s', result.intervalMillis);
        console.log('notifications sent: %s', result.notificationsSent);
        console.log('notifications expected: %s', result.notificationsExpected);
        console.log('notifications received: %s', result.notificationsReceived);
        console.log('min: %s', result.min);
        console.log('max: %s', result.max);
        console.log('avg: %s', result.avg);
        console.log('errors: %s', result.errors);
        console.log('--------------------------------------');
    },

    onNotifTestComplete: function (err) {
        if (err) {
            console.log('Error: ' + JSON.stringify(err));
        }
        console.log('Finished running notification tests.');
    }
};

app.start();
