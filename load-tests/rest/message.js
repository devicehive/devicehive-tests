var utils = require('../../common/utils.js');
var testUtils = require('./../common/test-utils');
var Http = require('./http');
var log = require('../../common/log.js');

function Message(config) {
    this.name = config.name;
    this.devicesCount = config.devices;
    this.requests = config.requests;
    this.intervalMillis = config.intervalMillis || 1000;
    this.deviceGuids = config.deviceGuids || [];
    this.names = config.names;
    this.requests = config.requests;

    this.index = 0;
    this.total = 0;
    this.sent = 0;
    this.received = 0;
}

Message.prototype = {
    run: function (callback) {

        this.devicesCount = Array.isArray(this.deviceGuids) ?
            this.deviceGuids.length : this.devicesCount;

        this.total = this.requests;

        var self = this;

        this.requestTime = {};

        var requestId = utils.getRequestId();
        var request = utils.clone(this.requests[requestId % this.requests.length]);
        testUtils.substitute(request.data, '{#name}', function () {
            return self.names[requestId % self.names.length];
        })

        var deviceGuid = testUtils.getDeviceGuid(this, requestId);

        var params = {
            method: request.method,
            path: '/device/' + deviceGuid + '/notification',
            data: request.data
        };

        var http = new Http();
        this.requestTime[requestId] = +new Date();
        http.send(params, function (err, result) {

            if (err) {
                return self.onError(err);
            }

            self.onResponse(err, result);
        });

        this.ondone = callback;
    },

    onResponse: function (err, result) {
        this.ondone(err, {});
    },

    // ----------------------------------------------- utils -------------------------------------------------

    sendMessages: function (conn, callback) {
        var self = this;
        conn.intervalId = setInterval(function () {
            if (self.index++ >= self.total) {
                clearInterval(conn.intervalId);
                conn.intervalId = null;
                return;
            }

            callback.call(self, conn);
        }, this.intervalMillis);
    },

    onError: function (err, conn) {
        log.error('-- Error: ' + JSON.stringify(err));
    }
}

module.exports = Message;