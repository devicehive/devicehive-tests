var async = require('async');
var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API Device Command', function () {
    this.timeout(90000);
    var url = null;

    var DEVICE = utils.getName('ws-device-cmd');
    var NETWORK = utils.getName('ws-network-cmd');
    var COMMAND = utils.getName('ws-command');

    var networkId = null;
    var deviceId = utils.getName('ws-device-cmd-id');
    var token= null;

    var device = null;

    beforeEach(function(done) {
        setTimeout(done, 1000);
    });

    before(function (done) {

        function getWsUrl(callback) {

            req.get(path.INFO).params({jwt: utils.jwt.admin}).send(function (err, result) {
                if (err) {
                    return callback(err);
                }
                url = result.webSocketServerUrl;
                callback();
            });
        }

        function createNetwork(callback) {
            var params = {
                jwt: utils.jwt.admin,
                data: {
                    name: NETWORK
                }
            };

            utils.create(path.NETWORK, params, function (err, result) {
                if (err) {
                    return callback(err);
                }

                networkId = result.id;
                callback()
            });
        }

        function createDevice(callback) {
            req.update(path.get(path.DEVICE, deviceId))
                .params(utils.device.getParamsObj(DEVICE, utils.jwt.admin,
                    networkId, {name: DEVICE, version: '1'}))
                .send(callback);
        }

        function createToken(callback) {
            var args = {
                actions: [
                    'GetDeviceCommand',
                    'CreateDeviceCommand',
                    'UpdateDeviceCommand'
                ],
                deviceIds: void 0,
                networkIds: void 0
            };
            utils.jwt.create(utils.admin.id, args.actions, args.networkIds, args.deviceIds,
                function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    token = result.accessToken;
                    callback();
                })
        }

        function createConn(callback) {
            device = new Websocket(url, 'device');
            device.connect(callback);
        }

        function authenticateConn(callback) {
            device.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: token
                })
                .send(callback);
        }

        async.series([
            getWsUrl,
            createNetwork,
            createDevice,
            createToken,
            createConn,
            authenticateConn
        ], done);
    });

    describe('#unauthorized', function(done) {
        it('should return error with refresh jwt token', function() {
            req.create(path.COMMAND.get(deviceId))
                .params({
                    jwt: utils.jwt.admin_refresh,
                    data: {command: COMMAND}
                })
                .expectError(401, 'Unauthorized')
                .send(done);
        });
    });

    describe('#command/subscribe', function () {
        function runTest(ts, done) {
            var requestId = getRequestId();
            var deviceParams = null;
            
            if (ts != null) {
                deviceParams = device.params({
                    action: 'command/subscribe',
                    requestId: requestId,
                    timestamp: ts
                });
            } else {
                deviceParams = device.params({
                    action: 'command/subscribe',
                    requestId: requestId
                });
            }
            deviceParams.expect({
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
                        jwt: utils.jwt.admin,
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
        }

        it('should subscribe to all device commands with timestamp, device auth', function (done) {
            runTest(new Date().toISOString(), done);
        });
        it('should subscribe to all device commands, device auth', function (done) {
            runTest(null, done);
        });

        it('should subscribe to device commands for single device', function (done) {
            var requestId = getRequestId();

            device.params({
                action: 'command/subscribe',
                deviceIds: [deviceId],
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
                        deviceId: deviceId,
                        command: { command: COMMAND }
                    });

                req.create(path.COMMAND.get(deviceId))
                    .params({
                        jwt: utils.jwt.admin,
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
                    utils.matches(err, {message: 'waitFor() timeout: hasn\'t got message \'command/insert\' for 2000ms'});
                    done();
                });

                req.create(path.COMMAND.get(deviceId))
                    .params({
                        jwt: utils.jwt.admin,
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
                    jwt: utils.jwt.admin,
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

        it('should update existing command, jwt auth', function (done) {

            var update = {
                command: COMMAND + '-UPD',
                parameters: {a: '1', b: '2'},
                lifetime: 100500,
                status: 'Updated',
                result: {done: 'yes'}
            };

            var requestId = getRequestId();
            device.params({
                    user: utils.admin,
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
                        deviceId: deviceId,
                        command: command
                    });

                req.create(path.COMMAND.get(deviceId))
                    .params({
                        jwt: utils.jwt.admin,
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
                utils.matches(err, {message: 'waitFor() timeout: hasn\'t got message \'command/insert\' for 2000ms'});
                done();
            });

            req.create(path.COMMAND.get(deviceId))
                .params({
                    jwt: utils.jwt.admin,
                    data: command
                })
                .send();
        });
    });

    after(function (done) {
        device.close();
        utils.clearDataJWT(done);
    });
});
