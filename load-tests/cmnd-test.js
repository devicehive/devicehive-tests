var WsConn = require('./ws-conn.js');
var Statistics = require('./statistics.js');
var utils = require('../common/utils.js');

var fs = require('fs');
var path = require('path');
var LOG_PATH = path.join(__dirname, 'load-tests-cmnd.txt');

function CommandTest(clientsCount, cmdCount, intervalMillis) {
    this.clientsCount = (clientsCount || 1);
    this.cmdCount = (cmdCount || 1);
    this.cmdReceived = 0;
    this.intervalMillis = (intervalMillis || 1000);
    this.clients = [];
    this.device = new WsConn('device');
    this.statistics = new Statistics();
}

CommandTest.prototype = {

    run: function () {
        this.device.props = {
            deviceGuid: utils.getConfig('cmndTest:deviceGuids')[0]
        };
        this.device.addActionCallback('authenticate', this.onDeviceAuthenticate, this);
        this.device.addActionCallback('command/subscribe', this.onDeviceSubscribed, this);
        this.device.addActionCallback('command/insert', this.onCommandReceived, this);
        this.device.connect();
    },

    onDeviceAuthenticate: function (data, device) {
        if (data.status !== 'success') {
            return this.device.onError(data);
        }
        console.log('%s auth complete', device.name);
        this.subscribeDevice(device);
    },

    subscribeDevice: function (device) {

        var data = {
            action: 'command/subscribe',
            deviceGuids: utils.getConfig('cmndTest:deviceGuids'),
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
            client.addActionCallback('command/update', this.onCommandResultReceived, this);
            client.connect();
            this.clients.push(client);
        }
    },

    onCommandReceived: function (data, device) {

        if (data.command.command !== 'cmd-load-testing') {
            return;
        }

        this.sendCommandResult(device, data.command);
    },

    sendCommandResult: function (device, command) {
        var data = {
            commandId: command.id,
            command: {
                status: 'done',
                requestTime: command.parameters.requestTime
            },
            deviceGuid: device.props.deviceGuid,
            requestId: utils.getRequestId(),
            action: "command/update"
        };

        device.send(data);
    },

    onAuthenticate: function (data, client) {
        if (data.status != 'success') {
            return client.onError(data);
        }
        console.log('%s auth complete', client.name);
        this.sendCommands(client);
    },

    onCommandResultReceived: function (data, client) {
        var time = +new Date() - data.command.parameters.requestTime;
        console.log('%s received command result in %d millis', client.name, time);

        this.statistics.add(time);
        this.done();
    },

    sendCommands: function (client) {
        var self = this;
        var i = 0;
        client.intervalId = setInterval(function () {
            if (i++ >= self.cmdCount) {
                clearInterval(client.intervalId);
                return;
            }

            self.sendCommand(client);
        }, this.intervalMillis);
    },

    sendCommand: function (client) {

        var requestId = utils.getRequestId();

        var time = new Date();
        var notifData = {
            action : 'command/insert',
            deviceGuid : utils.getConfig('cmndTest:deviceGuids')[0],
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

        if (++this.cmdReceived < (this.cmdCount * this.clientsCount)) {
            return;
        }

        this.closeConnections();

        var date = new Date();
        var result = {
            completedOn: date.toLocaleDateString() + ' ' + date.toLocaleTimeString(),
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