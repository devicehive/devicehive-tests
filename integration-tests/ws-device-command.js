var async = require('async');
var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API Device Command', function () {
    this.timeout(30000);
    var url = null;

    var DEVICE = utils.getName('ws-device-cmd');
    var DEVICE_KEY = utils.getName('ws-device-cmd-key');
    var NETWORK = utils.getName('ws-network-cmd');
    var COMMAND = utils.getName('ws-command');

    var deviceId = utils.getName('ws-device-cmd-id');

    var device = null;

    before(function (done) {

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

        function authenticateConn(callback) {
            device.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    deviceId:  deviceId,
                    deviceKey: DEVICE_KEY
                })
                .send(callback);
        }

        async.series([
            getWsUrl,
            createDevice,
            createConn,
            authenticateConn
        ], done);
    });

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
                    deviceId: deviceId,
                    commandId: commandId,
                    command: update
                })
                .expect({
                    action: 'command/update',
                    status: 'success',
                    requestId: requestId
                })
                .send(done);
        });
    });

    describe('#srv: command/insert', function () {

        it('should notify when command was inserted, device auth', function (done) {
            var command = {
                command: COMMAND,
                parameters: {a: '1', b: '2'},
                lifetime: 100500,
                status: 'Inserted',
                result: {done: 'yes'}
            };

            device.params({
                    action: 'command/subscribe',
                    requestId: getRequestId()
                })
                .send(onSubscribed);

            function onSubscribed(err) {
                if (err) {
                    return done(err);
                }

                device.waitFor('command/insert', cleanUp)
                    .expect({
                        action: 'command/insert',
                        deviceGuid: deviceId,
                        command: command
                    });

                req.create(path.COMMAND.get(deviceId))
                    .params({
                        user: utils.admin,
                        data: command
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

        it('should not notify when command was inserted without prior subscription, device auth', function (done) {
            var command = {
                command: COMMAND,
                parameters: {a: '3', b: '4'},
                lifetime: 500100,
                status: 'Inserted',
                result: {done: 'yes'}
            };

            device.waitFor('command/insert', function (err) {
                assert.strictEqual(!(!err), true, 'Commands should not arrive');
                utils.matches(err, {message: 'waitFor() timeout: hasn\'t got message \'command/insert\''});
                done();
            });

            req.create(path.COMMAND.get(deviceId))
                .params({
                    user: utils.admin,
                    data: command
                })
                .send();
        });
    });

    after(function (done) {
        device.close();
        utils.clearData(done);
    });
});
