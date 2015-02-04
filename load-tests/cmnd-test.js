var WsConn = require('./ws-conn.js');
var Statistics = require('./statistics.js');
var utils = require('../common/utils.js');
var log = require('../common/log.js');

function CommandTest(config) {
    this.name = config.name || '';

    this.clientsCount = config.clients || 1;
    this.devicesCount = config.devices;
    this.commandsPerClient = config.commandsPerClient || 1;
    this.intervalMillis = config.intervalMillis || 1000;
    this.sendToAllDevices = config.sendToAllDevices;
    this.deviceGuids = config.deviceGuids || [];
    this.commands = config.commands;
    this.parameters = config.parameters || {};
    this.waitDelay = config.waitDelay || 5000;

    this.cmndIndex = 0;
    this.cmndTotal = 0;
    this.cmndSent = 0;
    this.cmndReceived = 0;

    this.clients = [];
    this.devices = [];
    this.statistics = new Statistics();
    this.devicesSubscribed = 0;
}

CommandTest.prototype = {

    run: function (callback) {

        this.oncomplete = this.doComplete;

        log.info('-- Started \'%s\'', this.name);

        this.ondone = callback;
        this.statistics = new Statistics();

        this.devicesCount = Array.isArray(this.deviceGuids) ?
            this.deviceGuids.length : this.devicesCount;

        this.cmndTotal = this.commandsPerClient * this.clientsCount;

        this.createDevices();
    },

    createDevices: function () {
        for (var i = 0; i < this.devicesCount; i++) {
            var device = new WsConn('device');
            device.props = {
                deviceGuid: this.getDeviceGuid(i)
            };
            device.addErrorCallback(this.onError, this);
            device.addActionCallback('authenticate', this.onDeviceAuthenticate, this);
            device.addActionCallback('command/subscribe', this.onDeviceSubscribed, this);
            device.addActionCallback('command/insert', this.onCommandReceived, this);
            device.connect();
            this.devices.push(device);
        }
    },

    getDeviceGuid: function (index) {
        index = index % this.devicesCount;
        if (Array.isArray(this.deviceGuids)) {
            return this.deviceGuids[index];
        }

        var formattedNumber = ("00000" + index).slice(-5);
        return this.deviceGuids.replace('{#}', formattedNumber);
    },

    onDeviceAuthenticate: function (data, device) {
        if (data.status != 'success') {
            return device.onError(data);
        }
        log.debug('%s auth complete', device.name);
        this.subscribeDevice(device);
    },

    subscribeDevice: function (device) {

        var data = {
            action: 'command/subscribe',
            requestId: utils.getRequestId()
        };

        if (!this.sendToAllDevices) {
            data.deviceGuids = [ device.props.deviceGuid ];
        }

        if (this.commands) {
            data.names = [];
            var max = device.id % this.commands.length;
            for (var i = 0; i <= max; i++) {
                var command = this.commands[i];
                this.statistics.addSubscribed(command, data.deviceGuids);
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
        if (parameters != null && typeof(parameters) === "string") {
            parameters = JSON.parse(parameters);
        }

        var data = {
            commandId: command.id,
            command: {
                status: 'done',
                requestTime: parameters.requestTime
            },
            deviceGuid: device.props.deviceGuid,
            requestId: utils.getRequestId(),
            action: "command/update"
        };

        device.send(data);
    },

    createClients: function () {
        for (var i = 0; i < this.clientsCount; i++) {
            var client = new WsConn('client');
            client.props = {
                deviceGuids: this.getDeviceGuids(client)
            };
            client.addErrorCallback(this.onError, this);
            client.addActionCallback('authenticate', this.onClientAuthenticate, this);
            client.addActionCallback('command/update', this.onCommandResultReceived, this);
            client.connect();
            this.clients.push(client);
        }
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

    onClientAuthenticate: function (data, client) {
        if (data.status !== 'success') {
            return this.onError(data);
        }
        log.debug('%s auth complete', client.name);
        this.sendCommands(client);
    },

    onCommandResultReceived: function (data, client) {
        var parameters = data.command.parameters;
        if (parameters != null && typeof(parameters) === "string") {
            parameters = JSON.parse(parameters);
        }

        var time = +new Date() - parameters.requestTime;
        log.debug('%s received command \'%s\' result in %d millis', client.name, data.command.command, time);

        this.statistics.add(time);
        this.cmndReceived++;
    },

    sendCommands: function (client) {
        var self = this;
        client.intervalId = setInterval(function () {
            if (self.cmndIndex++ >= self.cmndTotal) {
                clearInterval(client.intervalId);
                client.intervalId = null;
                return;
            }

            self.sendCommand(client);
        }, this.intervalMillis);
    },

    sendCommand: function (client) {

        var requestId = utils.getRequestId();
        var time = new Date();
        var command = this.commands[requestId % this.commands.length];
        var deviceGuid = client.props.deviceGuids[requestId % client.props.deviceGuids.length];
        this.statistics.addExpected(command, deviceGuid);
        var parameters = utils.clone(this.parameters);
        parameters.requestTime = +time;

        var cmndData = {
            action : 'command/insert',
            deviceGuid: deviceGuid,
            command: {
                command: command,
                parameters: parameters
            },
            requestId: requestId
        };

        client.send(cmndData);
        this.doneAllSent();
    },

    doneAllSent: function () {
        if (++this.cmndSent < this.cmndTotal) {
            return;
        }

        var received = this.cmndReceived;
        var result = this.getResult();
        var self = this;

        var doneIfCmndsWontCome = function () {

            if (self.cmndReceived !== received) {
                received = self.cmndReceived;
                result = self.getResult();
                setTimeout(doneIfCmndsWontCome, self.waitDelay);
                return;
            }

            self.complete(null, result);
        };
        setTimeout(doneIfCmndsWontCome, this.waitDelay);

        log.info('-- All commands sent. %s sec wait for incoming commands...',
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
            end: this.statistics.getEnd(),
            clients: this.clientsCount,
            devices: this.devicesCount,
            commandsPerClient: this.commandsPerClient,
            intervalMillis: this.intervalMillis,
            commandsSent: this.cmndSent,
            commandsExpected: this.statistics.getExpected(),
            commandsReceived: this.cmndReceived,
            min: this.statistics.getMin(),
            max: this.statistics.getMax(),
            avg: this.statistics.getAvg(),
            errors: this.statistics.errors,
            errorsCount: this.statistics.errorsCount
        };
    },

    closeConnections: function (callback) {
        this.clients.forEach(function (client) {
            client.socket.close();
            if (client.intervalId) {
                clearInterval(client.intervalId);
            }
        });
        this.devices.forEach(function (device) {
            device.socket.close();
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

module.exports = CommandTest;