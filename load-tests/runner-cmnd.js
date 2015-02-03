var CommandTest = require('./cmnd-test');
var log = require('../common/log');

var fs = require('fs');
var path = require('path');
var LOG_PATH = path.join(__dirname, 'load-tests-cmnd.txt');

var runner = {

    start: function (config, callback) {

        if (config.disabled) {
            return callback();
        }

        var self = this;

        new CommandTest(config)
            .run(function (err, result) {
                self.saveResult(result);
                self.showResult(result, err);
                callback();
            });
    },

    saveResult: function (result) {
        var stream = fs.createWriteStream(LOG_PATH, { flags: 'a' });
        stream.write(JSON.stringify(result) + '\n');
    },

    showResult: function (result, err) {
        log.info('--------------------------------------');
        log.info('name: %s', result.name);
        log.info('start: %s', result.start);
        log.info('end: %s', result.end);
        log.info('clients: %s', result.clients);
        log.info('devices: %s', result.devices);
        log.info('commands per client: %s', result.commandsPerClient);
        log.info('interval, millis: %s', result.intervalMillis);
        log.info('commands sent: %s', result.commandsSent);
        log.info('commands expected: %s', result.commandsExpected);
        log.info('commands received: %s', result.commandsReceived);
        log.info('min: %s', result.min);
        log.info('max: %s', result.max);
        log.info('avg: %s', result.avg);
        log.info('errors: %s', result.errors);
        log.info('errors count: %s', result.errorsCount);

        if (err) {
            log.error('-- Error: ' + JSON.stringify(err));
        }

        log.info('--------------------------------------');
    },

    onComplete: function () {
        log.info('-- Finished running all command tests.');
    }
}

module.exports = {
    start: function (config, callback) {
        runner.start(config, callback);
    },
    saveResult: function (result) {
        runner.saveResult(result);
    }
}