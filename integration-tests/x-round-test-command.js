var async = require('async');
var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('Round tests for command', function () {
    this.timeout(60000);
    var url = null;

    var INTERVAL = 1000;
    var TOTAL_COMMANDS = 20;

    var COMMAND = utils.getName('round-command');
    var DEVICE = utils.getName('round-cmd-device');
    var DEVICE_KEY = utils.getName('round-cmd-device-key');

    var commands = [];

    var deviceDef = {
        name: DEVICE,
        key: DEVICE_KEY,
        status: 'Online',
        data: {a: '1', b: '2'},
        network: {
            name: utils.getName('round-cmd-network'),
            description: 'lorem ipsum dolor sit amet'
        },
        deviceClass: {
            name: DEVICE,
            version: '1',
            isPermanent: true,
            offlineTimeout: 1234,
            data: {c: '3', d: '4'},
            equipment: [{
                name: "_integr-test-eq",
                code: "321",
                type: "_integr-test-type",
                data: {e: '5', f: '6'}
            }]
        }
    };
    var deviceId = utils.getName('round-cmd-device-id');
    var networkId = null;

    var accessKey = null;

    var deviceConn = null;
    var clientConn = null;

    before(function (done) {

        function initCommands(callback) {

            for (var i = 0; i < TOTAL_COMMANDS; i++) {
                commands.push({
                    command: COMMAND,
                    parameters: {a: (i + 1), b: (i + 2)},
                    status: 'in progress ' + (i + 1)
                })
            }

            callback();
        }

        function getWsUrl(callback) {
            req.get(path.INFO).params({user: utils.admin}).send(function (err, result) {
                if (err) {
                    return callback(err);
                }
                url = result.webSocketServerUrl;
                callback();
            });
        }

        function createDevice(callback) {
            req.update(path.get(path.DEVICE, deviceId))
                .params({user: utils.admin, data: deviceDef})
                .send(function (err) {
                    if (err) {
                        return callback(err);
                    }

                    req.get(path.get(path.DEVICE, deviceId))
                        .params({user: utils.admin})
                        .send(function (err, result) {
                            if (err) {
                                return callback(err);
                            }

                            networkId = result.network.id;
                            callback();
                        })
                });
        }

        function createAccessKey(callback) {
            var args = {
                label: utils.getName('ws-access-key'),
                actions: [
                    'GetDeviceCommand',
                    'CreateDeviceCommand',
                    'UpdateDeviceCommand'
                ],
                networkIds: networkId
            };
            utils.accessKey.create(utils.admin, args.label, args.actions, void 0, args.networkIds,
                function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    accessKey = result.key;
                    callback();
                })
        }

        function createDeviceConn(callback) {
            deviceConn = new Websocket(url, 'device');
            deviceConn.connect(callback);
        }

        function authenticateDeviceConn(callback) {
            deviceConn.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    deviceId: deviceId,
                    deviceKey: DEVICE_KEY
                })
                .send(callback);
        }

        function createClientConn(callback) {
            clientConn = new Websocket(url, 'client');
            clientConn.connect(callback);
        }

        function authenticateClientConn(callback) {
            clientConn.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    accessKey: accessKey
                })
                .send(callback);
        }

        async.series([
            initCommands,
            getWsUrl,
            createDevice,
            createAccessKey,
            createDeviceConn,
            authenticateDeviceConn,
            createClientConn,
            authenticateClientConn
        ], done);
    });

    describe('#WS client -> WS device', function () {

        before(function (done) {
            deviceConn.params({
                    action: 'command/subscribe',
                    requestId: getRequestId()
                })
                .send(done);
        });

        function runTestDelayed(command, done) {
            setTimeout(function () {
                runTest(command, done);
            }, INTERVAL);
        }

        function runTest(command, done) {

            function sendCommand(callback) {

                deviceConn.waitFor('command/insert', callback)
                    .expect({
                        action: 'command/insert',
                        command: command
                    });

                clientConn.params({
                        action: 'command/insert',
                        requestId: getRequestId(),
                        deviceGuid: deviceId,
                        command: command
                    })
                    .send();
            }

            function sendReply(cmnd, callback) {

                var update = {
                    command: COMMAND,
                    lifetime: 100500,
                    status: 'updated',
                    result: {done: 'yes'}
                };

                clientConn.waitFor('command/update', callback)
                    .expect({
                        action: 'command/update',
                        command: update
                    });

                deviceConn.params({
                        action: 'command/update',
                        requestId: getRequestId(),
                        deviceGuid: deviceId,
                        commandId: cmnd.command.id,
                        command: update
                    })
                    .send();
            }

            async.waterfall([
                sendCommand,
                sendReply
            ], done);
        }

        it('should transfer commands to device and get updates on client', function (done) {
            async.eachSeries(commands, runTestDelayed, done);
        });

        after(function (done) {
            deviceConn.params({
                    action: 'command/unsubscribe',
                    requestId: getRequestId()
                })
                .send(done);
        });
    });

    after(function (done) {
        clientConn.close();
        deviceConn.close();
        utils.clearData(done);
    });
});
