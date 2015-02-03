var async = require('async');
var notifTests = require('./runner-notif');
var commandTests = require('./runner-cmnd');
var utils = require('../common/utils.js');

var app = {
    
    start: function () {
        var run = utils.getConfig('notifTest:runAsync') ?
            async.each : async.eachSeries;

        run(utils.getConfig('notifTest:groups'),
            notifTests.start, notifTests.onComplete);

        run = utils.getConfig('cmndTest:runAsync') ?
            async.each : async.eachSeries;

        run(utils.getConfig('cmndTest:groups'),
            commandTests.start, commandTests.onComplete);
    }

};

app.start();
