﻿var WsConn = require('./ws-conn.js');
var Statistics = require('./statistics.js');
var utils = require('../common/utils.js');

var fs = require('fs');
var path = require('path');
var LOG_PATH = path.join(__dirname, 'load-tests-notif.txt');

function NotifTest(devicesCount, notifCount, intervalMillis) {
    this.devicesCount = (devicesCount || 1);
    this.notifCount = (notifCount || 1);
    this.notifReceived = 0;
    this.intervalMillis = (intervalMillis || 100);
    this.devices = [];
    this.client = new WsConn('client');
    this.statistics = new Statistics();
}

NotifTest.prototype = {
    
    run: function () {
        this.client.addActionCallback('authenticate', this.onClientAuthenticate, this);
        this.client.addActionCallback('notification/subscribe', this.onClientSubscribed, this);
        this.client.addActionCallback('notification/insert', this.onNotificationReceived, this);
        this.client.connect();
    },
    
    onClientAuthenticate: function (data, client) {
        if (data.status !== 'success') {
            return this.client.onError(data);
        }
        console.log('%s auth done', client.name);
        this.subscribeClient(client);
    },
    
    subscribeClient: function (client) {
        
        var data = {
            action : 'notification/subscribe',
            deviceGuids : [utils.getConfig('server:deviceId')],
            names : null,
            requestId : utils.getRequestId()
        };
        
        client.socket.send(JSON.stringify(data));
    },
    
    onClientSubscribed: function (data, client) {
        console.log('%s subscribed', client.name);
        
        for (var i = 0; i < this.devicesCount; i++) {
            var device = new WsConn('device');
            device.addActionCallback('authenticate', this.onAuthenticate, this);
            device.connect();
            this.devices.push(device);
        }
    },
    
    onNotificationReceived: function (data, client) {
        
        if (data.notification.notification !== 'load-testing') {
            return;
        }
        
        var parameters = data.notification.parameters;

        var time = +new Date() - parameters.requestTime;
        console.log('%s received notification in %d millis', client.name, time);

        this.statistics.add(time);
        this.done();
    },
    
    onAuthenticate: function (data, device) {
        if (data.status != 'success') {
            return device.onError(data);
        }
        console.log('%s auth done', device.name);
        this.sendNotifications(device);
    },
    
    sendNotifications: function (device) {
        var self = this;
        var i = 0;
        device.intervalId = setInterval(function () {
            if (i++ >= self.notifCount) {
                clearInterval(device.intervalId);
                return;
            }

            self.sendNotification(device);
        }, this.intervalMillis);
    },
    
    sendNotification: function (device) {
        
        var requestId = utils.getRequestId();
        
        var time = new Date();
        var notifData = {
            action : 'notification/insert',
            deviceGuid : utils.getConfig('server:deviceId'),
            notification : {
                notification : 'load-testing',
                parameters : {
                    name : device.name + ' sensor',
                    tag : 'b27c94fed9e64f60aa893aa4e6458095',
                    time : time.toUTCString(),
                    value : 1234,
                    requestTime: +time
                }
            },
            requestId : requestId
        }
        
        device.socket.send(JSON.stringify(notifData));
    },

    done: function (device) {

        if (++this.notifReceived < (this.notifCount * this.devicesCount)) {
            return;
        }
        
        this.closeConnections();

        var self = this;
        
        var date = new Date();
        var result = {
            completedOn: date.toLocaleDateString() + ' ' + date.toLocaleTimeString(),
            devices: this.devicesCount,
            notifsPerDevice: this.notifCount,
            intervalMillis: this.intervalMillis,
            notificationsReceived: this.statistics.count,
            min: this.statistics.getMin(),
            max: this.statistics.getMax(),
            avg: this.statistics.getAvg()
        };

        console.log('--------------------------------------');
        console.log('devices: %s', result.devices);
        console.log('notifications per device: %s', result.notifsPerDevice);
        console.log('interval, millis: %s', result.intervalMillis);
        console.log('notifications received: %s', result.notificationsReceived);
        console.log('min: %s', result.min);
        console.log('max: %s', result.max);
        console.log('avg: %s', result.avg);

        var stream = fs.createWriteStream(LOG_PATH, { flags: 'a' });
        stream.write(JSON.stringify(result) + '\n');
    },

    closeConnections: function () {
        this.client.socket.close();
        this.devices.forEach(function (device) {
            device.socket.close();
        });
    }
}

module.exports = NotifTest;