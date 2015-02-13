var log = require('../../common/log.js');
var utils = require('../../common/utils.js');
var testUtils = require('./../common/test-utils');
var Http = require('./http');
var Statistics = require('./../common/statistics.js');
var Sender = require('./sender');

function Message(config) {
    this.name = config.name;
    this.sendersCount = config.senders || 1;
    this.devicesCount = config.devices;
    this.requestsPerSender = config.requestsPerSender || 1;
    this.intervalMillis = config.intervalMillis || 1000;
    this.deviceGuids = config.deviceGuids || [];
    this.names = config.names;
    this.requests = config.requests;
    this.waitDelay = config.waitDelay || 5000;

    this.index = 0;
    this.total = 0;
    this.sent = 0;
    this.received = 0;
    this.statistics = new Statistics();

    this.requestTime = {};

    this.senders = [];
}

Message.prototype = {
    run: function (callback) {

        this.oncomplete = this.doComplete;
        this.oncomplete = callback;
        this.ondone = callback;

        this.devicesCount = Array.isArray(this.deviceGuids) ?
            this.deviceGuids.length : this.devicesCount;

        this.total = this.requestsPerSender * this.sendersCount;

        for (var i = 0; i < this.sendersCount; i++) {
            var sender = new Sender(this);
            this.sendMessages(sender, this.sendRequest);
            this.senders.push(sender);
        }
    },

    sendRequest: function(sender) {
        var self = this;

        sender.send(function (err, sender, requestId, result) {
            self.onResponse(err, sender, requestId, result);
        });
        this.doneAllSent();
    },

    onResponse: function (err, sender, requestId, result) {

        if (err) {
            //this.statistics.serverErrorsCount++;
            return self.onError(err);
        }

        var time = +new Date() - sender.requestTime[requestId];
        this.statistics.add(time);

        this.received++
    },

    doComplete: function (err, result) {

        var self = this;

        this.senders.forEach(function (sender) {
            if (sender.intervalId) {
                clearInterval(sender.intervalId);
            }
        });

        log.info('-- Completed \'%s\'. Closing connnections...', this.name);

        if (self.ondone) {
            self.ondone(err, result);
            self.ondone = null;
        }
    },

    getResult: function () {
        return {
            name: this.name,
            start: this.statistics.getStart(),
            duration: this.statistics.getDuration(),
            connections: this.connCount,
            devices: this.devicesCount,
            requestsPerSender: this.requestsPerSender,
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

    onError: function (err) {
        this.statistics.errors = true;
        this.statistics.errorsCount++;
        log.error('-- Error: ' + JSON.stringify(err));
    },

    // ----------------------------------------------- utils -------------------------------------------------

    sendMessages: function (sender, callback) {
        var self = this;
        sender.intervalId = setInterval(function () {
            if (self.index++ >= self.total) {
                clearInterval(sender.intervalId);
                sender.intervalId = null;
                return;
            }

            callback.call(self, sender);
        }, this.intervalMillis);
    },

    doneAllSent: function () {
        if (++this.sent < this.total) {
            return;
        }

        var received = this.received;
        var result = this.getResult();
        var self = this;

        var doneIfMsgsWontCome = function () {

            if (self.received !== received) {
                received = self.received;
                result = self.getResult();
                setTimeout(doneIfMsgsWontCome, self.waitDelay);
                return;
            }

            self.complete(null, result);
        };
        setTimeout(doneIfMsgsWontCome, this.waitDelay);

        log.info('-- All messages sent. %s sec wait for incoming messages...',
            Math.floor(this.waitDelay / 1000));
    },

    complete: function (err, result) {
        if (this.oncomplete) {
            this.oncomplete(err, result)
            this.oncomplete = null;
        }
    }
}

module.exports = Message;