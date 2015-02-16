var log = require('../../common/log.js');
var testUtils = require('./../common/test-utils');
var Statistics = require('./../common/statistics.js');
var Sender = require('./http-sender');

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

        this.oncomplete = testUtils.doRestComplete;
        this.ondone = callback;

        this.devicesCount = Array.isArray(this.deviceGuids) ?
            this.deviceGuids.length : this.devicesCount;

        this.total = this.requestsPerSender * this.sendersCount;

        for (var i = 0; i < this.sendersCount; i++) {
            var sender = new Sender(this);
            testUtils.sendMessages(this, sender, this.sendRequest);
            this.senders.push(sender);
        }
    },

    sendRequest: function(sender) {
        var self = this;

        sender.send(function (err, sender, result) {
            self.onResponse(err, sender, result);
        });
        testUtils.doneAllSent(this);
    },

    onResponse: function (err, sender, result) {

        if (err) {
            //this.statistics.serverErrorsCount++;
            return this.onError(err);
        }

        var time = +new Date() - sender.requestTime[sender.requestId];
        this.statistics.add(time);

        this.received++
    },

    getResult: function () {
        return {
            name: this.name,
            start: this.statistics.getStart(),
            duration: this.statistics.getDuration(),
            senders: this.sendersCount,
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
    }
}

module.exports = Message;
