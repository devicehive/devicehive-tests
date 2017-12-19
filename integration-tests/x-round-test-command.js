var async = require('async');
var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('Round tests for command', function () {
    this.timeout(90000);
    var url = null;

    var TOTAL_COMMANDS = 10;

    var COMMAND = utils.getName('round-command');
    var DEVICE = utils.getName('round-cmd-device');
    var NETWORK = utils.getName('ws-cmd-network');
    var NETWORK_KEY = utils.getName('ws-cmd-network-key');

    var commands = [];

    var deviceDef = {
        name: DEVICE,
        status: 'Online',
        data: {a: '1', b: '2'}
    };
    var deviceId = utils.getName('round-cmd-device-id');
    var networkId = null;
    var deviceTypeId = null;

    var user = null;
    var jwt = null;

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
                data: { name: NETWORK, key: NETWORK_KEY }
            };

            utils.create(path.NETWORK, params, function (err, result) {
                if (err) {
                    return callback(err);
                }

                networkId = result.id;
                callback();
            });
        }

        function createDevice(callback) {
        	deviceDef.networkId = networkId;
            req.update(path.get(path.DEVICE, deviceId))
                .params({jwt: utils.jwt.admin, data: deviceDef})
                .send(function (err) {
                    if (err) {
                        return callback(err);
                    }

                    req.get(path.get(path.DEVICE, deviceId))
                        .params({jwt: utils.jwt.admin})
                        .send(function (err) {
                            if (err) {
                                return callback(err);
                            }

                            callback();
                        })
                });
        }

        function createUser(callback) {
            utils.createUser2(1, networkId, function (err, result) {
                if (err) {
                    return callback(err);
                }

                user = result.user;
                callback();
            });
        }

        function createJWT(callback) {
            var args = {
                actions: [
                    'GetDeviceCommand',
                    'CreateDeviceCommand',
                    'UpdateDeviceCommand'
                ],
                networkIds: networkId,
                deviceTypeIds: deviceTypeId,
                deviceIds: deviceId
            };
            utils.jwt.create(utils.admin.id, args.actions, args.networkIds, args.deviceTypeIds,
                function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    jwt = result.accessToken;
                    callback();
                })
        }

        function createDeviceConn(callback) {
            deviceConn = new Websocket(url);
            deviceConn.connect(callback);
        }

        function authenticateDeviceConn(callback) {
            deviceConn.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    deviceId: deviceId,
                    token: jwt
                })
                .send(callback);
        }

        function createClientConn(callback) {
            clientConn = new Websocket(url);
            clientConn.connect(callback);
        }

        function authenticateClientConn(callback) {
            clientConn.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: jwt
                })
                .send(callback);
        }

        async.series([
            initCommands,
            getWsUrl,
            createNetwork,
            createDevice,
            createUser,
            createJWT,
            createDeviceConn,
            authenticateDeviceConn,
            createClientConn,
            authenticateClientConn
        ], done);
    });

    describe('#WS client -> WS device', function () {

        before(function (done) {
            var requestId = getRequestId();
            deviceConn.params({
                action: 'command/subscribe',
                requestId: requestId
            }).send(function () {
                var requestId2 = getRequestId();
                clientConn.params({
                    action: 'command/subscribe',
                    returnUpdatedCommands: true,
                    requestId: requestId2
                }).send(done);        
            });
            
        });

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
                    deviceId: deviceId,
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
                    deviceId: deviceId,
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

        it('WS client -> WS device', function (done) {
            async.eachSeries(commands, runTest, done);
        });

        after(function (done) {
            var requestId = getRequestId();
            
            clientConn.params({
                action: 'command/unsubscribe',
                requestId: requestId
            }).send(function() {
                var requestId2 = getRequestId();
                
                deviceConn.params({
                    action: 'command/unsubscribe',
                    requestId: requestId2
                }).send(done);
            });
        });
    });

    describe('#REST client -> WS device', function () {

        var createPath = null;

        before(function (done) {

            createPath = path.COMMAND.get(deviceId);
            var requestId = getRequestId();
            deviceConn.params({
                    action: 'command/subscribe',
                    requestId: requestId
                }).expect({
                    action: 'command/subscribe',
                    requestId: requestId
                }).send(done);
        });

        function runTest(command, done) {

            function sendCommand(callback) {
                
                deviceConn.waitFor('command/insert', callback)
                    .expect({
                        action: 'command/insert',
                        command: command
                    });

                req.create(createPath)
                    .params({ jwt: jwt, data: command })
                    .send();
            }

            function sendReply(cmnd, callback) {

                var waitPath = path.combine(createPath, cmnd.command.id, path.POLL);

                var update = {
                    command: COMMAND,
                    lifetime: 100500,
                    status: 'updated',
                    result: {done: 'yes'}
                };

                utils.get(waitPath, {jwt: jwt}, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    assert.strictEqual(result.command, update.command);
                    assert.strictEqual(result.lifetime, update.lifetime);
                    assert.strictEqual(result.status, update.status);

                    callback();
                });

                setTimeout(function () {
                    var requestId = getRequestId();
                    deviceConn.params({
                        action: 'command/update',
                        requestId: requestId,
                        deviceId: deviceId,
                        commandId: cmnd.command.id,
                        command: update
                    }).expect({
                        action: 'command/update',
                        requestId: requestId,

                    }).send();
                }, 100);
            }

            async.waterfall([
                sendCommand,
                sendReply
            ], done);
        }

        it('REST client -> WS device', function (done) {
            async.eachSeries(commands, runTest, done);
        });

        after(function (done) {
            deviceConn.params({
                    action: 'command/unsubscribe',
                    requestId: getRequestId()
                })
                .send(done);
        });
    });

    describe('#WS client -> REST device', function () {

        var $path = null;
        var pollPath = null;

        before(function (done) {
            $path = path.COMMAND.get(deviceId);
            pollPath = path.combine($path, path.POLL);
            
            clientConn.params({
                action: 'command/subscribe',
                returnUpdatedCommands: true,
                requestId: getRequestId()
            })
                .send(done);
            
        });

        function runTest(command, done) {

            function sendCommand(callback) {

                req.get(pollPath)
                    .params({
                        jwt: jwt
                    })
                    .query('names', COMMAND)
                    .expect([command])
                    .send(callback);

                setTimeout(function () {
                    clientConn.params({
                        action: 'command/insert',
                        requestId: getRequestId(),
                        deviceId: deviceId,
                        command: command
                    })
                        .send();    
                }, 1000);
            }

            function sendReply(commands, callback) {

                var cmnd = commands[0];
                var update = {
                    command: COMMAND,
                    lifetime: 100500,
                    status: 'updated',
                    result: {done: 'yes'}
                };
                
                async.parallel({
                    one: function (cb) {
                        clientConn.waitFor('command/update', cb)
                            .expect({
                                action: 'command/update',
                                command: update
                            });        
                    },
                    two: function (cb) {
                        setTimeout(function () {
                            var updatePath = path.get($path, cmnd.id);
                            req.update(updatePath)
                                .params({
                                    jwt: jwt,
                                    data: update
                                })
                                .send(cb);
                        }, 1000);        
                    }
                }, function (err) {
                    if (err) {
                        callback(err);
                    }
                    
                    callback();
                });

                

                
            }

            async.waterfall([
                sendCommand,
                sendReply
            ], done);
        }

        it('WS client -> REST device', function (done) {
            async.eachSeries(commands, runTest, done);
        });
    });

    describe('#REST client -> REST device', function () {

        var clientAuth = null;
        var deviceAuth = null;

        var createPath = null;
        var pollPath = null;

        before(function () {
            createPath = path.COMMAND.get(deviceId);
            pollPath = path.combine(createPath, path.POLL);
        });

        function runTest(command, done) {

            function sendCommand(callback) {

                req.get(pollPath)
                    .params(utils.core.clone(deviceAuth))
                    .query('names', COMMAND)
                    .expect([command])
                    .send(callback);

                setTimeout(function () {
                    var params = utils.core.clone(clientAuth);
                    params.data = command;
                    req.create(createPath)
                        .params(params)
                        .send();
                }, 1000);
            }

            function sendReply(commands, callback) {

                var cmnd = commands[0];
                var waitPath = path.combine(createPath, cmnd.id, path.POLL);

                var update = {
                    command: COMMAND,
                    lifetime: 100500,
                    status: 'updated',
                    result: {done: 'yes'}
                };

                async.parallel({
                    one: function (cb) {
                        utils.get(waitPath, utils.core.clone(clientAuth), function (err, result) {
                            assert.strictEqual(!(!err), false, 'No error');
                            assert.strictEqual(result.command, update.command);
                            assert.strictEqual(result.lifetime, update.lifetime);
                            assert.strictEqual(result.status, update.status);

                            cb();
                        });
                    },
                    two: function (cb) {
                        setTimeout(function () {
                            var updatePath = path.get(createPath, cmnd.id);
                            var params = utils.core.clone(deviceAuth);
                            params.data = update;
                            req.update(updatePath)
                                .params(params)
                                .send(cb);
                        }, 500);
                    }
                }, function (err) {
                    if (err) {
                        callback(err);
                    }
    
                    callback();
                });
            }

            async.waterfall([
                sendCommand,
                sendReply
            ], done);
        }

        it('REST client -> REST device', function (done) {
            clientAuth = {jwt: jwt};
            deviceAuth = {jwt: jwt};
            async.eachSeries(commands, runTest, done);
        });
    });

    after(function (done) {
        clientConn.close();
        deviceConn.close();
        utils.clearDataJWT(done);
    });
});
