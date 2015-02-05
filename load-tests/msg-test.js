var WsConn = require('./ws-conn.js');
var Statistics = require('./statistics.js');
var utils = require('../common/utils.js');
var log = require('../common/log.js');

function MessageTest(config) {
    this.name = config.name || '';

    this.connCount = config.connections || 1;
    this.devicesCount = config.devices;
    this.messagesPerClient = config.messagesPerClient || 1;
    this.intervalMillis = config.intervalMillis || 1000;
    this.deviceGuids = config.deviceGuids || [];
    this.names = config.names;
    this.messages = config.messages;
    this.waitDelay = config.waitDelay || 5000;

    this.msgIndex = 0;
    this.msgTotal = 0;
    this.msgSent = 0;
    this.msgReceived = 0;

    this.connections = [];
    this.clientsSubscribed = 0;
}

MessageTest.prototype = {

    run: function (callback) {

        this.oncomplete = this.doComplete;

        log.info('-- Started \'%s\'', this.name);

        this.ondone = callback;
        this.statistics = new Statistics();
        this.requestTime = {};

        this.devicesCount = Array.isArray(this.deviceGuids) ?
            this.deviceGuids.length : this.devicesCount;

        this.msgTotal = this.messagesPerClient * this.connCount;

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

        this.msgReceived++
    },

    onConnAuthenticate: function (data, conn) {
        if (data.status !== 'success') {
            return this.onError(data, conn);
        }
        log.debug('%s auth complete', conn.name);
        this.sendMessages(conn);
    },

    sendMessages: function (conn) {
        var self = this;
        conn.intervalId = setInterval(function () {
            if (self.msgIndex++ >= self.msgTotal) {
                clearInterval(conn.intervalId);
                conn.intervalId = null;
                return;
            }

            self.sendMessage(conn);
        }, this.intervalMillis);
    },

    sendMessage: function (conn) {

        var self = this;

        var requestId = utils.getRequestId();
        var message = utils.clone(this.messages[requestId % this.messages.length]);

        this.substitute(message, '{#name}', function () {
            return self.names[requestId % self.names.length];
        });

        this.substitute(message, '{#deviceGuid}', function () {
            return self.getDeviceGuid(conn.id);
        });

        this.substitute(message, '{#deviceGuids}', function () {
            return self.getDeviceGuids(conn);
        });

        this.substitute(message, '{#requestId}', function () {
            return requestId;
        });

        this.requestTime[requestId] = +new Date();

        conn.send(message);
        this.doneAllSent();
    },

    substitute: function (obj, field, valueCb) {

        if (obj == null || typeof (obj) != 'object') {
            return;
        }

        var self = this;

        var keys = Object.keys(obj);
        keys.forEach(function (key) {

            if (obj[key] === field) {
                obj[key] = valueCb();
                return;
            }

            self.substitute(obj[key], field, valueCb);
        });

    },

    getDeviceGuids: function (client) {
        var index = client.id % this.connCount;
        if (this.devicesCount === this.connCount) {

            return [ this.getDeviceGuid(index) ];

        }
        if (this.devicesCount < this.connCount) {

            return [ this.getDeviceGuid(index) ];

        } else if (this.devicesCount > this.connCount) {

            var deviceGuids = [];
            var devicesPerClient = Math.ceil(this.devicesCount / this.connCount);
            var startIndex = index * devicesPerClient;
            var endIndex = Math.ceil(index * devicesPerClient + devicesPerClient);
            for (var i = startIndex; i < endIndex; i++) {
                deviceGuids.push(this.getDeviceGuid(i));
            }
            return deviceGuids;

        }
    },

    getDeviceGuid: function (index) {
        index = index % this.devicesCount;
        if (Array.isArray(this.deviceGuids)) {
            return this.deviceGuids[index];
        }

        var formattedNumber = ("00000" + index).slice(-5);
        return this.deviceGuids.replace('{#}', formattedNumber);
    },

    doneAllSent: function () {
        if (++this.msgSent < this.msgTotal) {
            return;
        }

        var received = this.msgReceived;
        var result = this.getResult();
        var self = this;

        var doneIfNotifsWontCome = function () {

            if (self.msgReceived !== received) {
                received = self.msgReceived;
                result = self.getResult();
                setTimeout(doneIfNotifsWontCome, self.waitDelay);
                return;
            }

            self.complete(null, result);
        };
        setTimeout(doneIfNotifsWontCome, this.waitDelay);

        log.info('-- All messages sent. %s sec wait for incoming messages...',
            Math.floor(this.waitDelay / 1000));
    },

    complete: function (err, result) {
        if (this.oncomplete) {
            this.oncomplete(err, result)
            this.oncomplete = null;
        }
    },

    doComplete: function (err, result) {
        var self = this;
        log.info('-- Completed \'%s\'. Closing connnections...', this.name);
        this.closeConnections(function () {
            if (self.ondone) {
                self.ondone(err, result);
                self.ondone = null;
            }
        });
    },

    getResult: function () {
        return {
            name: this.name,
            start: this.statistics.getStart(),
            end: this.statistics.getEnd(),
            connections: this.connCount,
            devices: this.devicesCount,
            messagesPerClient: this.messagesPerClient,
            intervalMillis: this.intervalMillis,
            messagesSent: this.msgSent,
            messagesExpected: this.msgSent,
            messagesReceived: this.msgReceived,
            min: this.statistics.getMin(),
            max: this.statistics.getMax(),
            avg: this.statistics.getAvg(),
            med: this.statistics.getMedian(),
            serverErrorsCount: this.statistics.serverErrorsCount,
            errors: this.statistics.errors,
            errorsCount: this.statistics.errorsCount
        };
    },

    closeConnections: function (callback) {
        this.connections.forEach(function (conn) {
            conn.socket.close();
            if (conn.intervalId) {
                clearInterval(conn.intervalId);
            }
        });

        if (callback) {
            callback();
        }
    },

    onError: function (err, conn) {
        this.statistics.errors = true;
        this.statistics.errorsCount++;
        log.error('-- Error: ' + JSON.stringify(err));
        conn.socket.close();
        if (conn.intervalId) {
            clearInterval(conn.intervalId);
        }

        //this.complete({
        //    message: 'Error in ' + conn.name,
        //    error: err
        //}, this.getResult());
    }
};

module.exports = MessageTest;