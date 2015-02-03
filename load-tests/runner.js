﻿var async = require('async');
var TestTypes = require('./runner-test-types');
var utils = require('../common/utils');
var log = require('../common/log');

var fs = require('fs');
var path = require('path');

var app = {

    testTypes: new TestTypes(),

    start: function () {
        var run = utils.getConfig('loadTests:runAsync') ?
            async.each : async.eachSeries;

        run(utils.getConfig('loadTests:tests'),
            app.executeTest, app.onComplete);
    },

    executeTest: function (config, callback) {

        if (config.disabled) {
            return callback();
        }

        app.testTypes.create(config)
            .run(function (err, result) {
                app.saveResult(config, result);
                app.showResult(config, result, err);
                callback();
            });
    },

    saveResult: function (config, result) {
        var logPath = path.join(__dirname, this.testTypes.filename(config));
        var stream = fs.createWriteStream(logPath, { flags: 'a' });
        stream.write(JSON.stringify(result) + '\n');
    },

    showResult: function (config, result, err) {
        app.testTypes.showResult(config, result, err);
    },

    onComplete: function () {
        log.info('-- Finished running all tests.');
    }
};

app.start();
