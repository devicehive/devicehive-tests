var async = require('async');
var assert = require('assert');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API Device Command', function () {
    var url = null;

    var DEVICE = utils.getName('ws-device-cmd');
    var DEVICE_KEY = utils.getName('ws-device-cmd-key');
    var NETWORK = utils.getName('ws-network-cmd');
    var COMMAND = utils.getName('ws-command');

    var deviceId = utils.getName('ws-device-cmd-id');

    var device = null;

    before(function (done) {
        utils.clearOldEntities(function () {
            init(done);
        });
    });

    function init(done) {

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
                .params(utils.device.getParamsObj(DEVICE, utils.admin, DEVICE_KEY,
                    {name: NETWORK}, {name: DEVICE, version: '1'}))
                .send(callback);
        }

        function createConn(callback) {
            device = new Websocket(url, 'device');
            device.connect(callback);
        }

        // TODO: Access Key auth is used temporarily, since device auth won't work for Websockets
        function authenticateConn(callback) {
            var args = {
                label: utils.getName('ws-access-key'),
                actions: [
                    'GetDeviceCommand',
                    'CreateDeviceCommand',
                    'UpdateDeviceCommand'
                ]
            };
            utils.accessKey.create(utils.admin, args.label, args.actions, void 0, void 0,
                function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    device.params({
                            action: 'authenticate',
                            requestId: getRequestId(),
                            accessKey: result.key
                        })
                        .send(callback);
                });
        }

        //function authenticateConn(callback) {
        //    device.params({
        //            action: 'authenticate',
        //            requestId: getRequestId(),
        //            deviceId:  deviceId,
        //            deviceKey: DEVICE_KEY
        //        })
        //        .send(callback);
        //}

        async.series([
            getWsUrl,
            createDevice,
            createConn,
            authenticateConn
        ], done);
    }

    describe('#command/subscribe', function () {

        it('should subscribe to device commands, device auth', function (done) {
            var requestId = getRequestId();

            device.params({
                    action: 'command/subscribe',
                    requestId: requestId
                })
                .expect({
                    action: 'command/subscribe',
                    requestId: requestId,
                    status: 'success'
                })
                .send(onSubscribed);

            function onSubscribed(err) {
                if (err) {
                    return done(err);
                }

                device.waitFor('command/insert', cleanUp)
                    .expect({
                        action: 'command/insert',
                        command: { command: COMMAND }
                    });

                req.create(path.COMMAND.get(deviceId))
                    .params({
                        user: utils.admin,
                        data: {command: COMMAND}
                    })
                    .send();

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    device.params({
                            action: 'command/unsubscribe',
                            requestId: getRequestId()
                        })
                        .send(done);
                }
            }
        });
    });

    describe('#command/unsubscribe', function () {

        it('should unsubscribe from device commands, device auth', function (done) {

            device.params({
                    action: 'command/subscribe',
                    requestId: getRequestId()
                })
                .send(onSubscribed);

            function onSubscribed(err) {
                if (err) {
                    return done(err);
                }

                var requestId = getRequestId();
                device.params({
                        action: 'command/unsubscribe',
                        requestId: requestId
                    })
                    .expect({
                        action: 'command/unsubscribe',
                        requestId: requestId,
                        status: 'success'
                    })
                    .send(onUnubscribed);
            }

            function onUnubscribed(err) {
                if (err) {
                    return done(err);
                }

                device.waitFor('command/insert', function (err) {
                    assert.strictEqual(!(!err), true, 'Commands should not arrive');
                    utils.matches(err, {message: 'waitFor() timeout: hasn\'t got message \'command/insert\''});
                    done();
                });

                req.create(path.COMMAND.get(deviceId))
                    .params({
                        user: utils.admin,
                        data: {command: COMMAND}
                    })
                    .send();
            }
        });
    });

    describe('#command/update', function () {

        var commandId = null;
        before(function (done) {
            req.create(path.COMMAND.get(deviceId))
                .params({
                    user: utils.admin,
                    data: {command: COMMAND}
                })
                .send(function (err, result) {
                    if (err) {
                        done(err);
                    }

                    commandId = result.id;
                    done();
                });
        });

        it('should update existing command, device auth', function (done) {

            var update = {
                command: COMMAND + '-UPD',
                parameters: {a: '1', b: '2'},
                lifetime: 100500,
                status: 'Updated',
                result: {done: 'yes'}
            };

            var requestId = getRequestId();
            device.params({
                    action: 'command/update',
                    requestId: requestId,
                    deviceId: deviceId, // TODO: test fails since 'deviceId' param is used. No fail if using param 'deviceGuid'
                    //deviceGuid: deviceId,
                    commandId: commandId,
                    command: update
                })
                .expect({
                    action: 'command/update',
                    status: 'success',
                    requestId: requestId
                })
                .send(onCommandUpdated);

            function onCommandUpdated(err) {
                if (err) {
                    return done(err);
                }

                req.get(path.COMMAND.get(deviceId))
                    .params({user: utils.admin, id: commandId})
                    .expect({id: commandId})
                    .expect(update)
                    .send(done);
            }
        });
    });

    after(function (done) {
        device.close();
        utils.clearResources(done);
    });
});
