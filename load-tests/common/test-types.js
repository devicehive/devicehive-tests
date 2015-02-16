﻿var Command = require('./../websockets/command');
var Notification = require('./../websockets/notification');
var Message = require('./../websockets/message');
var RestMessage = require('./../rest/message');
var log = require('../../common/log');

function TestTypes() {
}

TestTypes.prototype = {

    create: function (config) {
        return this[config.type].create(config);
    },

    showResult: function (config, result, err) {
        return this[config.type].showResult(result, err);
    },

    'ws-notification': {
        create: function (config) {
            return new Notification(config);
        },

        showResult: function (result, err) {
            log.info('--------------------------------------');
            log.info('name: %s', result.name);
            log.info('start: %s', result.start);
            log.info('duration: %s', result.duration);
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
            log.info('med: %s', result.med);
            log.info('errors: %s', result.errors);
            log.info('errors count: %s', result.errorsCount);

            if (err) {
                log.error('-- Error: ' + JSON.stringify(err));
            }

            log.info('--------------------------------------');

            log.summary('duration: %s\tconns: %s\tmin: %s\tmax: %s\tavg: %s\tmed: %s\terrors: %s\tsent: %s\texpected: %s\treceived: %s',
                result.duration,
                result.clients + result.devices,
                result.min,
                result.max,
                result.avg,
                result.med,
                result.errorsCount,
                result.notificationsSent,
                result.notificationsExpected,
                result.notificationsReceived);
        }
    },

    'ws-command': {
        create: function (config) {
            return new Command(config);
        },

        showResult: function (result, err) {
            log.info('--------------------------------------');
            log.info('name: %s', result.name);
            log.info('start: %s', result.start);
            log.info('duration: %s', result.duration);
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
            log.info('med: %s', result.med);
            log.info('errors: %s', result.errors);
            log.info('errors count: %s', result.errorsCount);

            if (err) {
                log.error('-- Error: ' + JSON.stringify(err));
            }

            log.info('--------------------------------------');

            log.summary('duration: %s\tconns: %s\tmin: %s\tmax: %s\tavg: %s\tmed: %s\terrors: %s\tsent: %s\texpected: %s\treceived: %s',
                result.duration,
                result.clients + result.devices,
                result.min,
                result.max,
                result.avg,
                result.med,
                result.errorsCount,
                result.commandsSent,
                result.commandsExpected,
                result.commandsReceived);
        }
    },

    'ws-message': {
        create: function (config) {
            return new Message(config);
        },

        showResult: function (result, err) {
            log.info('--------------------------------------');
            log.info('name: %s', result.name);
            log.info('start: %s', result.start);
            log.info('duration: %s', result.duration);
            log.info('connections: %s', result.connections);
            log.info('devices: %s', result.devices);
            log.info('messages per client: %s', result.messagesPerClient);
            log.info('interval, millis: %s', result.intervalMillis);
            log.info('messages sent: %s', result.messagesSent);
            log.info('messages expected: %s', result.messagesExpected);
            log.info('messages received: %s', result.messagesReceived);
            log.info('min: %s', result.min);
            log.info('max: %s', result.max);
            log.info('avg: %s', result.avg);
            log.info('med: %s', result.med);
            log.info('server errors count: %s', result.serverErrorsCount);
            log.info('errors: %s', result.errors);
            log.info('errors count: %s', result.errorsCount);

            if (err) {
                log.error('-- Error: ' + JSON.stringify(err));
            }

            log.info('--------------------------------------');

            log.summary('duration: %s\tconns: %s\tmin: %s\tmax: %s\tavg: %s\tmed: %s\terrors: %s\tsent: %s\texpected: %s\treceived: %s',
                result.duration,
                result.connections,
                result.min,
                result.max,
                result.avg,
                result.med,
                result.errorsCount,
                result.messagesSent,
                result.messagesExpected,
                result.messagesReceived);
        }
    },

    'rest-message': {
        create: function (config) {
            return new RestMessage(config);
        },

        showResult: function (result, err) {
            log.info('--------------------------------------');
            log.info('name: %s', result.name);
            log.info('start: %s', result.start);
            log.info('duration: %s', result.duration);
            log.info('senders: %s', result.senders);
            log.info('devices: %s', result.devices);
            log.info('requests per sender: %s', result.requestsPerSender);
            log.info('interval, millis: %s', result.intervalMillis);
            log.info('messages sent: %s', result.messagesSent);
            log.info('messages expected: %s', result.messagesExpected);
            log.info('messages received: %s', result.messagesReceived);
            log.info('min: %s', result.min);
            log.info('max: %s', result.max);
            log.info('avg: %s', result.avg);
            log.info('med: %s', result.med);
            log.info('server errors count: %s', result.serverErrorsCount);
            log.info('errors: %s', result.errors);
            log.info('errors count: %s', result.errorsCount);

            if (err) {
                log.error('-- Error: ' + JSON.stringify(err));
            }

            log.info('--------------------------------------');

            log.summary('duration: %s\tsenders: %s\tmin: %s\tmax: %s\tavg: %s\tmed: %s\terrors: %s\tsent: %s\texpected: %s\treceived: %s',
                result.duration,
                result.senders,
                result.min,
                result.max,
                result.avg,
                result.med,
                result.errorsCount,
                result.messagesSent,
                result.messagesExpected,
                result.messagesReceived);
        }
    }
}

module.exports = TestTypes;