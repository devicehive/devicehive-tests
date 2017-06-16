var Sender = require('./ws-sender.js');
var Statistics = require('./../common/statistics.js');
var testUtils = require('./../common/test-utils');
var utils = require('../../common/utils.js');
var log = require('../../common/log.js');

function Notification(config) {
    this.name = config.name || '';

    this.clientsCount = config.clients || 1;
    this.devicesCount = config.devices;
    this.notifsPerDevice = config.notifsPerDevice || 1;
    this.intervalMillis = config.intervalMillis || 1000;
    this.listenAllDevices = config.listenAllDevices;
    this.deviceIds = config.deviceIds || [];
    this.notifications = config.notifications;
    this.parameters = config.parameters || {};
    this.waitDelay = config.waitDelay || 5000;

    this.index = 0;
    this.total = 0;
    this.sent = 0;
    this.received = 0;

    this.clients = [];
    this.devices = [];
    this.clientsSubscribed = 0;
}

Notification.prototype = {

    run: function (callback) {

        log.info('-- Started \'%s\'', this.name);

        this.oncomplete = function (context, err, result) {
            testUtils.doWsComplete(context, err, result);
        };
        this.ondone = callback;
        this.statistics = new Statistics();

        this.devicesCount = Array.isArray(this.deviceIds) ?
            this.deviceIds.length : this.devicesCount;

        this.total = this.notifsPerDevice * this.devicesCount;

        this.createClients();
    },

    createClients: function () {
        for (var i = 0; i < this.clientsCount; i++) {
            var client = new Sender('client');
            client.addErrorCallback(this.onError, this);
            client.addActionCallback('authenticate', this.onClientAuthenticate, this);
            client.addActionCallback('notification/subscribe', this.onClientSubscribed, this);
            client.addActionCallback('notification/insert', this.onNotificationReceived, this);
            client.connect();
            this.clients.push(client);
        }
    },

    onClientAuthenticate: function (data, client) {
        var self = this;
        testUtils.onWsAuthenticate(data, client, function (data, client) {
            self.subscribeClient(client);
        });
    },

    subscribeClient: function (client) {

        var data = {
            action: 'notification/subscribe',
            requestId: utils.getRequestId()
        };

        if (!this.listenAllDevices) {
            data.deviceIds = testUtils.getDeviceGuids(this, client.id);
        }

        if (this.notifications) {
            data.names = [];
            var max = client.id % this.notifications.length;
            for (var i = 0; i <= max; i++) {
                var notification = this.notifications[i];
                this.statistics.addSubscribed(notification, data.deviceIds);
                data.names.push(notification);
            }
        }

        client.send(data);
    },

    onClientSubscribed: function (data, client) {
        log.debug('%s subscribed', client.name);

        if (++this.clientsSubscribed === this.clientsCount) {
            this.createDevices();
        }
    },

    createDevices: function () {
        for (var i = 0; i < this.devicesCount; i++) {
            var device = new Sender('device');
            device.props = {
                deviceId: testUtils.getDeviceId(this, i)
            };
            device.addErrorCallback(this.onError, this);
            device.addActionCallback('authenticate', this.onDeviceAuthenticate, this);
            device.connect();
            this.devices.push(device);
        }
    },

    onNotificationReceived: function (data, client) {
        var parameters = data.notification.parameters;
        if (parameters != null && typeof(parameters) === 'string') {
            parameters = JSON.parse(parameters);
        }

        var time = +new Date() - parameters.requestTime;
        log.debug('%s received notification \'%s\' in %d millis', client.name, data.notification.notification, time);

        this.statistics.add(time);
        this.received++;
    },

    onDeviceAuthenticate: function (data, device) {
        var self = this;
        testUtils.onWsAuthenticate(data, device, function (data, device) {
            testUtils.sendMessages(self, device, self.sendNotification);
        });
    },

    sendNotification: function (device) {

        var requestId = utils.getRequestId();
        var time = new Date();
        var notification = this.notifications[requestId % this.notifications.length];
        this.statistics.addExpected(notification, device.props.deviceId);
        var parameters = utils.clone(this.parameters);
        parameters.requestTime = +time;

        var notifData = {
            action: 'notification/insert',
            deviceId: device.props.deviceId,
            notification: {
                notification: notification,
                parameters: parameters
            },
            requestId: requestId
        };

        device.send(notifData);
        testUtils.doneAllSent(this);
    },

    getResult: function () {
        return {
            name: this.name,
            start: this.statistics.getStart(),
            duration: this.statistics.getDuration(),
            clients: this.clientsCount,
            devices: this.devicesCount,
            notifsPerDevice: this.notifsPerDevice,
            intervalMillis: this.intervalMillis,
            notificationsSent: this.sent,
            notificationsExpected: this.statistics.getExpected(),
            notificationsReceived: this.received,
            min: this.statistics.getMin(),
            max: this.statistics.getMax(),
            avg: this.statistics.getAvg(),
            med: this.statistics.getMedian(),
            errors: this.statistics.errors,
            errorsCount: this.statistics.errorsCount
        };
    },

    onError: function (err, sender) {
        testUtils.onWsError(this, err, sender);
    }
};

module.exports = Notification;