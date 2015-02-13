var Test = require('./test');
var testUtils = require('./../common/test-utils');
var WsConn = require('./ws-conn.js');
var Statistics = require('./../common/statistics.js');
var utils = require('../../common/utils.js');
var log = require('../../common/log.js');

function Message(config) {
    Test.mixin(Message);

    this.name = config.name || '';

    this.connCount = config.connections || 1;
    this.devicesCount = config.devices;
    this.messagesPerClient = config.messagesPerClient || 1;
    this.intervalMillis = config.intervalMillis || 1000;
    this.deviceGuids = config.deviceGuids || [];
    this.names = config.names;
    this.messages = config.messages;
    this.waitDelay = config.waitDelay || 5000;

    this.index = 0;
    this.total = 0;
    this.sent = 0;
    this.received = 0;

    this.connections = [];
    this.clientsSubscribed = 0;
}

Message.prototype = {

    run: function (callback) {

        this.oncomplete = this.doComplete;

        log.info('-- Started \'%s\'', this.name);

        this.ondone = callback;
        this.statistics = new Statistics();
        this.requestTime = {};

        this.devicesCount = Array.isArray(this.deviceGuids) ?
            this.deviceGuids.length : this.devicesCount;

        this.total = this.messagesPerClient * this.connCount;

        this.createClients();
    },

    createClients: function () {
        var self = this;
        for (var i = 0; i < this.connCount; i++) {
            var conn = new WsConn('conn');
            conn.addErrorCallback(this.onError, this);
            conn.addActionCallback('authenticate', this.onConnAuthenticate, this);

            this.messages.forEach(function(message) {
                conn.addActionCallback(message.action, self.onAction, self);
            });

            conn.connect();
            this.connections.push(conn);
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

    onConnAuthenticate: function (data, conn) {
        var self = this;
        this.onAuthenticate(data, conn, function (data, conn) {
            self.sendMessages(conn, self.sendMessage);
        });
    },

    sendMessage: function (conn) {

        var self = this;

        var requestId = utils.getRequestId();
        var message = utils.clone(this.messages[requestId % this.messages.length]);

        testUtils.substitute(message, '{#name}', function () {
            return self.names[requestId % self.names.length];
        });

        testUtils.substitute(message, '{#deviceGuid}', function () {
            return self.getDeviceGuid(conn.id);
        });

        testUtils.substitute(message, '{#deviceGuids}', function () {
            return self.getDeviceGuids(conn);
        });

        testUtils.substitute(message, '{#requestId}', function () {
            return requestId;
        });

        this.requestTime[requestId] = +new Date();

        conn.send(message);
        this.doneAllSent();
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
    }
};

module.exports = Message;