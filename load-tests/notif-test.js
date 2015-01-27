var WsConn = require('./ws-conn.js');
var Statistics = require('./statistics.js');
var utils = require('../common/utils.js');

function NotifTest(config) {
    this.name = config.name || '';

    this.clientsCount = config.clients || 1;
    this.devicesCount = config.devices;
    this.notifCount = config.notifsPerDevice || 1;
    this.intervalMillis = config.intervalMillis || 1000;
    this.listenAllDevices = config.listenAllDevices;
    this.deviceGuids = config.deviceGuids || [];
    this.notifications = config.notifications;
    this.parameters = config.parameters || {};
    
    this.notifIndex = 0;
    this.notifTotal = 0;
    this.notifSent = 0;
    this.notifReceived = 0;
    
    this.clients = [];
    this.devices = [];
    this.statistics = new Statistics();
}

NotifTest.prototype = {
    
    run: function (callback) {
        
        console.log('-- Started \'%s\'', this.name);
        
        this.ondone = callback;
        this.start = new Date();
        
        this.devicesCount = Array.isArray(this.deviceGuids) ? 
            this.deviceGuids.length : this.devicesCount;

        this.notifTotal = this.notifCount * this.devicesCount;
        
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
            return this.client.onError(data);
        }
        console.log('%s auth done', client.name);
        this.subscribeClient(client);
    },
    
    subscribeClient: function (client) {
        
        var data = {
            action : 'notification/subscribe',
            requestId : utils.getRequestId()
        };
        
        if (this.notifications) {
            data.names = this.notifications;
        }
        
        if (!this.listenAllDevices) {
            data.deviceGuids = this.getDeviceGuids(client);
        }
        
        client.send(JSON.stringify(data));
    },
    
    getDeviceGuids: function (client) {
        var index = client.id % this.clientsCount;
        if (this.devicesCount === this.clientsCount) {

            return this.getDeviceGuid(index);

        } if (this.devicesCount < this.clientsCount) {

            return this.getDeviceGuid(index);

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
        console.log('%s subscribed', client.name);
        
        if (this.clients.length < this.clientsCount) {
            return;
        }
        
        for (var i = 0; i < this.devicesCount; i++) {
            var device = new WsConn('device');
            device.props = {
                deviceGuid: this.getDeviceGuid(i)
            },
            device.addErrorCallback(this.onError, this);
            device.addActionCallback('authenticate', this.onAuthenticate, this);
            device.connect();
            this.devices.push(device);
        }
    },
    
    getDeviceGuid: function (index) {
        if (Array.isArray(this.deviceGuids)) {
            return this.deviceGuids[index % this.deviceGuids.length];
        }

        var formattedNumber = ("00000" + index).slice(-5);
        return this.deviceGuids.replace('{#}', formattedNumber);
    },
    
    onNotificationReceived: function (data, client) {
        var parameters = data.notification.parameters;
        
        var time = +new Date() - parameters.requestTime;
        console.log('%s received notification \'%s\' in %d millis', client.name, data.notification.notification, time);
        
        this.statistics.add(time);
        this.notifReceived++;
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
        var parameters = utils.clone(this.parameters);
        parameters.requestTime = +time;

        var notifData = {
            action : 'notification/insert',
            deviceGuid : device.props.deviceGuid,
            notification : {
                notification : this.notifications[requestId % this.notifications.length],
                parameters : parameters
            },
            requestId : requestId
        }
        
        device.send(JSON.stringify(notifData));
        this.doneAllSent();
    },
    
    doneAllSent: function (device) {
        
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
                setTimeout(doneIfNotifsWontCome, 5000);
                return;
            }
            
            self.done(null, result);
        }
        setTimeout(doneIfNotifsWontCome, 5000);

        console.log('-- All notifications sent. 5 secs wait for incoming notifications...');
    },
    
    done: function (err, result) {
        this.closeConnections();
        if (this.ondone) {
            this.ondone(err, result);
            this.ondone = null;
        }
        console.log('-- Completed \'%s\'', this.name);
    },
    
    getResult: function () {
        
        var end = new Date();
        var result = {
            name: this.name,
            start: this.start.toLocaleDateString() + ' ' + this.start.toLocaleTimeString(),
            end: end.toLocaleDateString() + ' ' + end.toLocaleTimeString(),
            clients: this.clientsCount,
            devices: this.devicesCount,
            notifsPerDevice: this.notifCount,
            intervalMillis: this.intervalMillis,
            notificationsSent: this.notifSent,
            notificationsExpected: this.notifSent * this.clientsCount,
            notificationsReceived: this.notifReceived,
            min: this.statistics.getMin(),
            max: this.statistics.getMax(),
            avg: this.statistics.getAvg(),
            errors: this.statistics.errors
        };
        
        return result;
    },
    
    closeConnections: function () {
        this.clients.forEach(function (client) {
            client.socket.close();
        });
        this.devices.forEach(function (device) {
            device.socket.close();
            if (device.intervalId) {
                clearInterval(device.intervalId);
            }
        });
    },
    
    onError: function (err, conn) {
        this.statistics.errors = true;
        this.done({
            message: 'Error in %s' + conn.name,
            error: err
        }, this.getResult());
    }
}

module.exports = NotifTest;