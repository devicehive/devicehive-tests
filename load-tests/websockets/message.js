var Sender = require('./ws-sender.js');
var Statistics = require('./../common/statistics.js');
var testUtils = require('./../common/test-utils');
var utils = require('../../common/utils.js');
var log = require('../../common/log.js');

function Message(config) {
    this.name = config.name || '';

    this.connCount = config.connections || 1;
    this.devicesCount = config.devices;
    this.messagesPerClient = config.messagesPerClient || 1;
    this.intervalMillis = config.intervalMillis || 1000;
    this.deviceIds = config.deviceIds || [];
    this.names = config.names;
    this.messages = config.messages;
    this.waitDelay = config.waitDelay || 5000;

    this.index = 0;
    this.total = 0;
    this.sent = 0;
    this.received = 0;

    this.connections = [];
    this.clientsSubscribed = 0;

    this.statistics = new Statistics();
}

Message.prototype = {

    run: function (callback) {

        log.info('-- Started \'%s\'', this.name);

        this.oncomplete = function (context, err, result) {
            testUtils.doWsComplete(context, err, result);
        };
        this.ondone = callback;
        this.requestTime = {};

        this.devicesCount = Array.isArray(this.deviceIds) ?
            this.deviceIds.length : this.devicesCount;

        this.total = this.messagesPerClient * this.connCount;

        this.createClients();
    },

    createClients: function () {
        var self = this;
        for (var i = 0; i < this.connCount; i++) {
            var sender = new Sender('conn');
            sender.addErrorCallback(this.onError, this);
            sender.addActionCallback('authenticate', this.onConnAuthenticate, this);

            this.messages.forEach(function(message) {
                sender.addActionCallback(message.action, self.onAction, self);
            });

            sender.connect();
            this.connections.push(sender);
        }
    },

    onAction: function (data, client) {

        if (this.requestTime[data.requestId]) {
            var time = +new Date() - this.requestTime[data.requestId];
            log.debug('%s got reply for \'%s\' in %d millis', client.name, data.action, time);
            this.statistics.add(time);
        }

        if (data.status === 'error') {
            this.statistics.serverErrorsCount++;
        }

        this.received++
    },

    onConnAuthenticate: function (data, sender) {
        var self = this;
        testUtils.onWsAuthenticate(data, sender, function (data, sender) {
            testUtils.sendMessages(self, sender, self.sendMessage);
        });
    },

    sendMessage: function (sender) {

        var self = this;

        var requestId = utils.getRequestId();
        var message = utils.clone(this.messages[requestId % this.messages.length]);

        testUtils.substitute(message, '{#name}', function () {
            return self.names[requestId % self.names.length];
        });

        testUtils.substitute(message, '{#deviceId}', function () {
            return testUtils.getDeviceId(self, sender.id);
        });

        testUtils.substitute(message, '{#deviceIds}', function () {
            return testUtils.getDeviceIds(self, sender);
        });

        testUtils.substitute(message, '{#requestId}', function () {
            return requestId;
        });

        this.requestTime[requestId] = +new Date();

        sender.send(message);
        testUtils.doneAllSent(this);
    },

    getResult: function () {
        return {
            name: this.name,
            start: this.statistics.getStart(),
            duration: this.statistics.getDuration(),
            connections: this.connCount,
            devices: this.devicesCount,
            messagesPerClient: this.messagesPerClient,
            intervalMillis: this.intervalMillis,
            messagesSent: this.sent,
            messagesExpected: this.sent,
            messagesReceived: this.received,
            min: this.statistics.getMin(),
            max: this.statistics.getMax(),
            avg: this.statistics.getAvg(),
            med: this.statistics.getMedian(),
            serverErrorsCount: this.statistics.serverErrorsCount,
            errors: this.statistics.errors,
            errorsCount: this.statistics.errorsCount
        };
    },

    onError: function (err, sender) {
        testUtils.onWsError(this, err, sender);
    }
};

module.exports = Message;