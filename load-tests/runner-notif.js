var NotifTest = require('./notif-test');
var log = require('../common/log');

var fs = require('fs');
var path = require('path');
var LOG_PATH = path.join(__dirname, 'load-tests-notif.txt');

var runner = {

    start: function (config, callback) {

        if (config.disabled) {
            return callback();
        }

        var self = this;

        new NotifTest(config)
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
        log.info('notifications per device: %s', result.notifsPerDevice);
        log.info('interval, millis: %s', result.intervalMillis);
        log.info('notifications sent: %s', result.notificationsSent);
        log.info('notifications expected: %s', result.notificationsExpected);
        log.info('notifications received: %s', result.notificationsReceived);
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
        log.info('-- Finished running all notification tests.');
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