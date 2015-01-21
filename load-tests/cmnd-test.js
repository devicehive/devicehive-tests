var WsConn = require('./ws-conn.js');
var Statistics = require('./statistics.js');
var utils = require('../common/utils.js');

var fs = require('fs');
var path = require('path');
var LOG_PATH = path.join(__dirname, 'load-tests-cmnd.txt');

function CommandTest(clientsCount, cmdCount, intervalMillis) {
    this.clientsCount = (clientsCount || 1);
    this.cmdCount = (cmdCount || 1);
    this.intervalMillis = (intervalMillis || 1000);
    this.clients = [];
    this.device = new WsConn('device');
    this.clientsDone = 0;
    this.statistics = new Statistics();
}

CommandTest.prototype = {
    
    run: function () {
        this.device.addActionCallback('authenticate', this.onDeviceAuthenticate, this);
        this.device.addActionCallback('command/subscribe', this.onDeviceSubscribed, this);
        this.device.addActionCallback('command/insert', this.onCommandReceived, this);
        this.device.connect();
    },
    
    onDeviceAuthenticate: function (data, device) {
        if (data.status !== 'success') {
            return this.device.onError(data);
        }
        console.log('%s auth done', device.name);
        this.subscribeDevice(device);
    },
    
    subscribeDevice: function (device) {
        
        var data = {
            action: 'command/subscribe',
            deviceGuids: [utils.getConfig('server:deviceId')], 
            names: null, 
            requestId: utils.getRequestId()
        }
        
        device.socket.send(JSON.stringify(data));
    },
    
    onDeviceSubscribed: function (data, device) {
        console.log('%s subscribed', device.name);
        
        for (var i = 0; i < this.clientsCount; i++) {
            var client = new WsConn('client');
            client.addActionCallback('authenticate', this.onAuthenticate, this);
            client.connect();
            this.clients.push(client);
        }
    },
    
    onCommandReceived: function (data, device) {
        
        if (data.command.command !== 'cmd-load-testing') {
            return;
        }
        
        var parameters = data.command.parameters;

        var time = +new Date() - parameters.requestTime;
        console.log('%s received command in %d millis', device.name, time);

        this.statistics.add(time);
    },
    
    onAuthenticate: function (data, client) {
        if (data.status != 'success') {
            return client.onError(data);
        }
        console.log('%s auth done', client.name);
        this.sendCommands(client);
    },
    
    sendCommands: function (client) {
        var self = this;
        var i = 0;
        client.intervalId = setInterval(function () {
            if (i++ >= self.cmdCount) {
                clearInterval(client.intervalId);
                self.done();
                return;
            }

            self.sendNotification(client);
        }, this.intervalMillis);
    },
    
    sendNotification: function (client) {
        
        var requestId = utils.getRequestId();
        
        var time = new Date();
        var notifData = {
            action : 'command/insert',
            deviceGuid : utils.getConfig('server:deviceId'),
            requestId : requestId,
            command : {
                command : 'cmd-load-testing',
                parameters : {
                    name : client.name + ' sensor',
                    tag : 'b27c94fed9e64f60aa893aa4e6458095',
                    time : time.toUTCString(),
                    value : 1234,
                    requestTime: +time
                }
            }
        }
        
        client.socket.send(JSON.stringify(notifData));
    },

    done: function (client) {
        if (++this.clientsDone < this.clientsCount) {
            return;
        }
        
        this.closeConnections();
        
        var self = this;
        
        var result = {
            clients: this.clientsCount,
            cmndsPerDevice: this.cmdCount,
            intervalMillis: this.intervalMillis,
            commandsReceived: this.statistics.count,
            min: this.statistics.getMin(),
            max: this.statistics.getMax(),
            avg: this.statistics.getAvg()
        };

        console.log('--------------------------------------');
        console.log('clients: %s', result.clients);
        console.log('commands per client: %s', result.cmndsPerDevice);
        console.log('interval, millis: %s', result.intervalMillis);
        console.log('commands received: %s', result.commandsReceived);
        console.log('min: %s', result.min);
        console.log('max: %s', result.max);
        console.log('avg: %s', result.avg);

        var stream = fs.createWriteStream(LOG_PATH, { flags: 'a' });
        stream.write(JSON.stringify(result) + '\n');
    },
    
    closeConnections: function () {
        this.device.socket.close();
        this.clients.forEach(function (client) {
            client.socket.close();
        });
    }
}

module.exports = CommandTest;