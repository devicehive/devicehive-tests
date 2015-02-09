var WsConn = require('./ws-conn.js');
var Statistics = require('./statistics.js');
var utils = require('../common/utils.js');
var log = require('../common/log.js');

function NotifTest(config) {
    this.name = config.name || '';

    this.clientsCount = config.clients || 1;
    this.devicesCount = config.devices;
    this.notifsPerDevice = config.notifsPerDevice || 1;
    this.intervalMillis = config.intervalMillis || 1000;
    this.listenAllDevices = config.listenAllDevices;
    this.deviceGuids = config.deviceGuids || [];
    this.notifications = config.notifications;
    this.parameters = config.parameters || {};
    this.waitDelay = config.waitDelay || 5000;

    this.notifIndex = 0;
    this.notifTotal = 0;
    this.notifSent = 0;
    this.notifReceived = 0;

    this.clients = [];
    this.devices = [];
    this.clientsSubscribed = 0;
}

NotifTest.prototype = {

    run: function (callback) {

        this.oncomplete = this.doComplete;

        log.info('-- Started \'%s\'', this.name);

        this.ondone = callback;
        this.statistics = new Statistics();

        this.devicesCount = Array.isArray(this.deviceGuids) ?
            this.deviceGuids.length : this.devicesCount;

        this.notifTotal = this.notifsPerDevice * this.devicesCount;

        this.createClients();
    },

    createClients: function () {
        for (var i = 0; i < this.clientsCount; i++) {
            var client = new WsConn('client');
            client.addErrorCallback(this.onError, this);
            client.addActionCallback('authenticate', this.onClientAuthenticate, this);
            client.addActionCallback('notification/subscribe', this.onClientSubscribed, this);
            client.addActionCallback('notification/insert', this.onNotificationReceived, this);
            client.connect();
            this.clients.push(client);
        }
    },

    onClientAuthenticate: function (data, client) {
        if (data.status !== 'success') {
            return this.onError(data, client);
        }
        log.debug('%s auth complete', client.name);
        this.subscribeClient(client);
    },

    subscribeClient: function (client) {

        var data = {
            action: 'notification/subscribe',
            requestId: utils.getRequestId()
        };

        if (!this.listenAllDevices) {
            data.deviceGuids = this.getDeviceGuids(client);
        }

        if (this.notifications) {
            data.names = [];
            var max = client.id % this.notifications.length;
            for (var i = 0; i <= max; i++) {
                var notification = this.notifications[i];
                this.statistics.addSubscribed(notification, data.deviceGuids);
                data.names.push(notification);
            }
        }

        client.send(data);
    },

    getDeviceGuids: function (client) {
        var index = client.id % this.clientsCount;
        if (this.devicesCount === this.clientsCount) {

            return [ this.getDeviceGuid(index) ];

        }
        if (this.devicesCount < this.clientsCount) {

            return [ this.getDeviceGuid(index) ];

        } else if (this.devicesCount > this.clientsCount) {

            var deviceGuids = [];
            var devicesPerClient = Math.ceil(this.devicesCount / this.clientsCount);
            var startIndex = index * devicesPerClient;
            var endIndex = Math.ceil(index * devicesPerClient + devicesPerClient);
            for (var i = startIndex; i < endIndex; i++) {
                deviceGuids.push(this.getDeviceGuid(i));
            }
            return deviceGuids;

        }
    },

    onClientSubscribed: function (data, client) {
        log.debug('%s subscribed', client.name);

        if (++this.clientsSubscribed === this.clientsCount) {
            this.createDevices();
        }
    },

    createDevices: function () {
        for (var i = 0; i < this.devicesCount; i++) {
            var device = new WsConn('device');
            device.props = {
                deviceGuid: this.getDeviceGuid(i)
            };
            device.addErrorCallback(this.onError, this);
            device.addActionCallback('authenticate', this.onDeviceAuthenticate, this);
            device.connect();
            this.devices.push(device);
        }
    },

    getDeviceGuid: function (index) {
        index = index % this.devicesCount;
        if (Array.isArray(this.deviceGuids)) {
            return this.deviceGuids[index];
        }

        var formattedNumber = ("00000000" + index).slice(-8);
        return this.deviceGuids.replace('{#}', formattedNumber);
    },

    onNotificationReceived: function (data, client) {
        var parameters = data.notification.parameters;
        if (parameters != null && typeof(parameters) === 'string') {
            parameters = JSON.parse(parameters);
        }

        var time = +new Date() - parameters.requestTime;
        log.debug('%s received notification \'%s\' in %d millis', client.name, data.notification.notification, time);

        this.statistics.add(time);
        this.notifReceived++;
    },

    onDeviceAuthenticate: function (data, device) {
        if (data.status != 'success') {
            return device.onError(data, device);
        }
        log.debug('%s auth complete', device.name);
        this.sendNotifications(device);
    },

    sendNotifications: function (device) {
        var self = this;
        device.intervalId = setInterval(function () {
            if (self.notifIndex++ >= self.notifTotal) {
                clearInterval(device.intervalId);
                device.intervalId = null;
                return;
            }

            self.sendNotification(device);
        }, this.intervalMillis);
    },

    sendNotification: function (device) {

        var requestId = utils.getRequestId();
        var time = new Date();
        var notification = this.notifications[requestId % this.notifications.length];
        this.statistics.addExpected(notification, device.props.deviceGuid);
        var parameters = utils.clone(this.parameters);
        parameters.requestTime = +time;

        var notifData = {
            action: 'notification/insert',
            deviceGuid: device.props.deviceGuid,
            notification: {
                notification: notification,
                parameters: parameters
            },
            requestId: requestId
        };

        device.send(notifData);
        this.doneAllSent();
    },

    doneAllSent: function () {
        if (++this.notifSent < this.notifTotal) {
            return;
        }

        var received = this.notifReceived;
        var result = this.getResult();
        var self = this;

        var doneIfNotifsWontCome = function () {

            if (self.notifReceived !== received) {
                received = self.notifReceived;
                result = self.getResult();
                setTimeout(doneIfNotifsWontCome, self.waitDelay);
                return;
            }

            self.complete(null, result);
        };
        setTimeout(doneIfNotifsWontCome, this.waitDelay);

        log.info('-- All notifications sent. %s sec wait for incoming notifications...',
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
            duration: this.statistics.getDuration(),
            clients: this.clientsCount,
            devices: this.devicesCount,
            notifsPerDevice: this.notifsPerDevice,
            intervalMillis: this.intervalMillis,
            notificationsSent: this.notifSent,
            notificationsExpected: this.statistics.getExpected(),
            notificationsReceived: this.notifReceived,
            min: this.statistics.getMin(),
            max: this.statistics.getMax(),
            avg: this.statistics.getAvg(),
            med: this.statistics.getMedian(),
            errors: this.statistics.errors,
            errorsCount: this.statistics.errorsCount
        };
    },

    closeConnections: function (callback) {
        this.clients.forEach(function (client) {
            client.socket.close();
        });
        this.devices.forEach(function (device) {
            device.socket.close();
            if (device.intervalId) {
                clearInterval(device.intervalId);
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

module.exports = NotifTest;