var Sender = require('./ws-sender.js');
var Statistics = require('./../common/statistics.js');
var testUtils = require('./../common/test-utils');
var utils = require('../../common/utils.js');
var log = require('../../common/log.js');

function Command(config) {
    this.name = config.name || '';

    this.clientsCount = config.clients || 1;
    this.devicesCount = config.devices;
    this.commandsPerClient = config.commandsPerClient || 1;
    this.intervalMillis = config.intervalMillis || 1000;
    this.sendToAllDevices = config.sendToAllDevices;
    this.deviceIds = config.deviceIds || [];
    this.commands = config.commands;
    this.parameters = config.parameters || {};
    this.waitDelay = config.waitDelay || 5000;

    this.index = 0;
    this.total = 0;
    this.sent = 0;
    this.received = 0;

    this.clients = [];
    this.devices = [];
    this.statistics = new Statistics();
    this.devicesSubscribed = 0;
}

Command.prototype = {

    run: function (callback) {

        log.info('-- Started \'%s\'', this.name);

        this.oncomplete = function (context, err, result) {
            testUtils.doWsComplete(context, err, result);
        };
        this.ondone = callback;
        this.statistics = new Statistics();

        this.devicesCount = Array.isArray(this.deviceIds) ?
            this.deviceIds.length : this.devicesCount;

        this.total = this.commandsPerClient * this.clientsCount;

        this.createDevices();
    },

    createDevices: function () {
        for (var i = 0; i < this.devicesCount; i++) {
            var device = new Sender('device');
            device.props = {
                deviceId: testUtils.getDeviceId(this, i)
            };
            device.addErrorCallback(this.onError, this);
            device.addActionCallback('authenticate', this.onDeviceAuthenticate, this);
            device.addActionCallback('command/subscribe', this.onDeviceSubscribed, this);
            device.addActionCallback('command/insert', this.onCommandReceived, this);
            device.connect();
            this.devices.push(device);
        }
    },

    onDeviceAuthenticate: function (data, device) {
        var self = this;
        testUtils.onWsAuthenticate(data, device, function (data, device) {
            self.subscribeDevice(device);
        });
    },

    subscribeDevice: function (device) {

        var data = {
            action: 'command/subscribe',
            requestId: utils.getRequestId()
        };

        if (!this.sendToAllDevices) {
            data.deviceIds = [device.props.deviceId];
        }

        if (this.commands) {
            data.names = [];
            var max = device.id % this.commands.length;
            for (var i = 0; i <= max; i++) {
                var command = this.commands[i];
                this.statistics.addSubscribed(command, data.deviceIds);
                data.names.push(command);
            }
        }

        device.send(data);
    },

    onDeviceSubscribed: function (data, device) {
        log.debug('%s subscribed', device.name);

        if (++this.devicesSubscribed === this.devicesCount) {
            this.createClients();
        }
    },

    onCommandReceived: function (data, device) {
        this.sendCommandResult(device, data.command);
    },

    sendCommandResult: function (device, command) {

        var parameters = command.parameters;
        if (parameters != null && typeof(parameters) === 'string') {
            parameters = JSON.parse(parameters);
        }

        var data = {
            commandId: command.id,
            command: {
                originSessionId: command.originSessionId,
                status: 'done',
                parameters: {
                    requestTime: parameters.requestTime
                }
            },
            //deviceId: device.props.deviceId, // won't work although it specified in spec...
            deviceId: device.props.deviceId,
            requestId: utils.getRequestId(),
            action: 'command/update'
        };

        device.send(data);
    },

    createClients: function () {
        for (var i = 0; i < this.clientsCount; i++) {
            var client = new Sender('client');
            client.props = {
                deviceIds: testUtils.getDeviceGuids(this, client.id)
            };
            client.addErrorCallback(this.onError, this);
            client.addActionCallback('authenticate', this.onClientAuthenticate, this);
            client.addActionCallback('command/update', this.onCommandResultReceived, this);
            client.connect();
            this.clients.push(client);
        }
    },

    onClientAuthenticate: function (data, client) {
        var self = this;
        testUtils.onWsAuthenticate(data, client, function (data, client) {
            testUtils.sendMessages(self, client, self.sendCommand);
        });
    },

    onCommandResultReceived: function (data, client) {
        var parameters = data.command.parameters;
        if (parameters != null && typeof(parameters) === 'string') {
            parameters = JSON.parse(parameters);
        }

        var time = +new Date() - parameters.requestTime;
        log.debug('%s received command \'%s\' result in %d millis', client.name, data.command.command, time);

        this.statistics.add(time);
        this.received++;
    },

    sendCommand: function (client) {

        var requestId = utils.getRequestId();
        var time = new Date();
        var command = this.commands[requestId % this.commands.length];
        var deviceId = client.props.deviceIds[requestId % client.props.deviceIds.length];
        this.statistics.addExpected(command, deviceId);
        var parameters = utils.clone(this.parameters);
        parameters.requestTime = +time;

        var cmndData = {
            action: 'command/insert',
            deviceId: deviceId,
            command: {
                command: command,
                parameters: parameters
            },
            requestId: requestId
        };

        client.send(cmndData);
        testUtils.doneAllSent(this);
    },

    getResult: function () {
        return {
            name: this.name,
            start: this.statistics.getStart(),
            duration: this.statistics.getDuration(),
            clients: this.clientsCount,
            devices: this.devicesCount,
            commandsPerClient: this.commandsPerClient,
            intervalMillis: this.intervalMillis,
            commandsSent: this.sent,
            commandsExpected: this.statistics.getExpected(),
            commandsReceived: this.received,
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

module.exports = Command;