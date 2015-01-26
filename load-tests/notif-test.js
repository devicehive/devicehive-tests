var WsConn = require('./ws-conn.js');
var Statistics = require('./statistics.js');
var utils = require('../common/utils.js');

var fs = require('fs');
var path = require('path');
var LOG_PATH = path.join(__dirname, 'load-tests-notif.txt');

function NotifTest() {
    this.clientsCount = 1;
    this.devicesCount = 1;
    this.notifCount = 1;
    this.intervalMillis = 1000;
    this.deviceGuids = [];
    this.names = [];
    
    this.notifIndex = 0;
    this.notifTotal = 0;
    this.notifSent = 0;
    this.notifReceived = 0;
    
    this.clients = [];
    this.devices = [];
    this.statistics = new Statistics();
}

NotifTest.prototype = {
    
    run: function () {
        
        this.start = new Date();
        
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
            deviceGuids : this.deviceGuids,
            names : this.names,
            requestId : utils.getRequestId()
        };
        
        client.socket.send(JSON.stringify(data));
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
        return this.deviceGuids[index % this.deviceGuids.length];
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
            deviceGuid : device.props.deviceGuid,
            notification : {
                notification : this.names[requestId % this.names.length],
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
        this.doneAllSent();
    },
    
    doneAllSent: function (device) {
        
        if (++this.notifSent < this.notifTotal) {
            return;
        }
        
        console.log('All notifications sent');
        
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
            
            self.done(result);
        }
        setTimeout(doneIfNotifsWontCome, 5000);
    },
    
    done: function (result) {
        this.closeConnections();
        var stream = fs.createWriteStream(LOG_PATH, { flags: 'a' });
        stream.write(JSON.stringify(result) + '\n');
    },
    
    getResult: function () {
        
        var end = new Date();
        var result = {
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
        
        console.log('--------------------------------------');
        console.log('start: %s', result.start);
        console.log('end: %s', result.end);
        console.log('clients: %s', result.clients);
        console.log('devices: %s', result.devices);
        console.log('notifications per device: %s', result.notifsPerDevice);
        console.log('interval, millis: %s', result.intervalMillis);
        console.log('notifications sent: %s', result.notificationsSent);
        console.log('notifications expected: %s', result.notificationsExpected);
        console.log('notifications received: %s', result.notificationsReceived);
        console.log('min: %s', result.min);
        console.log('max: %s', result.max);
        console.log('avg: %s', result.avg);
        console.log('errors: %s', result.errors);
        
        return result;
    },
    
    closeConnections: function () {
        this.clients.forEach(function (client) {
            client.socket.close();
        });
        this.devices.forEach(function (device) {
            device.socket.close();
        });
    },
    
    onError: function (err, conn) {
        console.log('Error in %s: %s', conn.name, JSON.stringify(err));
        this.statistics.errors++;
        conn.socket.close();
    }
}

module.exports = NotifTest;