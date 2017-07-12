var async = require('async');
var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API Command', function () {
    this.timeout(90000);
    var url = null;

    var DEVICE = utils.getName('ws-cmd-device');
    var NETWORK = utils.getName('ws-cmd-network');
    var NETWORK_KEY = utils.getName('ws-cmd-network-key');

    var COMMAND = utils.getName('ws-command');
    var COMMAND1 = utils.getName('ws-command-1');
    var COMMAND2 = utils.getName('ws-command-2');

    var deviceId = utils.getName('ws-cmd-device-id');
    var user = null;
    var token = null;
    var invalidToken = null;
    var device = null;
    var commandId1 = null;
    var commandId2 = null;

    var clientToken = null;
    var clientInvalidToken = null;

    beforeEach(function(done) {
        setTimeout(done, 1000);
    });

    before(function (done) {
        var networkId = null;

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

        function createUser(callback) {
            utils.createUser2(1, networkId, function (err, result) {
                if (err) {
                    return callback(err);
                }

                user = result.user;
                callback();
            });
        }

        function createDevice(callback) {
            req.update(path.get(path.DEVICE, deviceId))
                .params(utils.device.getParamsObj(DEVICE, utils.jwt.admin,
                    networkId, {name: DEVICE, version: '1'}))
                .send(callback);
        }

        function insertCommand1(callback) {
            var params = {
                jwt: utils.jwt.admin,
                data: {
                    command: COMMAND1
                }
            };

            utils.create(path.COMMAND.get(deviceId), params, function (err, result) {
                if (err) {
                    return callback(err);
                }

                commandId1 = result.id;
                callback();
            });
        }

        function insertCommand2(callback) {
            var params = {
                jwt: utils.jwt.admin,
                data: {
                    command: COMMAND2
                }
            };

            utils.create(path.COMMAND.get(deviceId), params, function (err, result) {
                if (err) {
                    return callback(err);
                }

                commandId2 = result.id;
                callback();
            });
        }

        function createToken(callback) {
            var args = {
                actions: [
                    'GetDeviceCommand',
                    'CreateDeviceCommand',
                    'UpdateDeviceCommand'
                ],
                deviceIds: deviceId,
                networkIds: networkId
            };
            utils.jwt.create(user.id, args.actions, args.networkIds, args.deviceIds, function (err, result) {
                if (err) {
                    return callback(err);
                }
                token = result.accessToken;
                callback()
            })
        }

        function createInvalidToken(callback) {
            var args = {
                actions: [ 'GetNetwork' ],
                deviceIds: deviceId,
                networkIds: networkId
            };
            utils.jwt.create(user.id, args.actions, args.networkIds, args.deviceIds, function (err, result) {
                if (err) {
                    return callback(err);
                }
                invalidToken = result.accessToken;
                callback()
            })
        }

        function createConn(callback) {
            device = new Websocket(url);
            device.connect(callback);
        }

        function createConnTokenAuth(callback) {
            clientToken = new Websocket(url);
            clientToken.connect(callback);
        }

        function createConnInvalidTokenAuth(callback) {
            clientInvalidToken = new Websocket(url);
            clientInvalidToken.connect(callback);
        }
        function authenticateWithToken(callback) {
            clientToken.params({
                action: 'authenticate',
                requestId: getRequestId(),
                token: token
            })
                .send(callback);
        }

        function authenticateWithInvalidToken(callback) {
            clientInvalidToken.params({
                action: 'authenticate',
                requestId: getRequestId(),
                token: invalidToken
            })
                .send(callback);
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
            createUser,
            createDevice,
            insertCommand1,
            insertCommand2,
            createToken,
            createInvalidToken,
            createConnTokenAuth,
            createConnInvalidTokenAuth,
            createConn,
            authenticateWithToken,
            authenticateWithInvalidToken,
            authenticateConn
        ], done);
    });
    
    describe('#Invalid credentials', function(done) {
        it('should return error with refresh token', function() {
            clientToken.params({
                action: 'authenticate',
                requestId: getRequestId(),
                token: utils.jwt.admin_refresh
            })
                .expectError(401, 'Invalid credentials')
                .send(done);
        });
    });

    describe('#command/insert', function () {

        var command = {
            command: COMMAND,
            status: 'in progress'
        };

        function runTest(client, done) {
            var requestId = getRequestId();
            client.params({
                    action: 'command/insert',
                    requestId: requestId,
                    deviceId: deviceId,
                    command: command
                })
                .expect({
                    action: 'command/insert',
                    status: 'success',
                    requestId: requestId
                })
                .assert(function (result) {
                    utils.hasPropsWithValues(result.command, ['id', 'timestamp', 'userId']);
                })
                .send(onInsert);

            function onInsert(err, result) {
                if (err) {
                    return done(err);
                }

                var commandId = result.command.id;
                req.get(path.COMMAND.get(deviceId))
                    .params({jwt: utils.jwt.admin, id: commandId})
                    .expect({id: commandId})
                    .expect(command)
                    .send(done);
            }
        }

        it('should add new command, jwt auth', function (done) {
            runTest(clientToken, done);
        });

        it('should fail when using wrong jwt', function (done) {
            clientInvalidToken.params({
                    action: 'command/insert',
                    requestId: getRequestId(),
                    deviceId: deviceId,
                    command: command
                })
                .expectError(401, 'Unauthorized')
                .send(done);
        });
        
    });

    describe('#command/list', function () {

        function runTest(client, done) {
            var requestId = getRequestId();
            client.params({
                action: 'command/list',
                requestId: requestId,
                deviceId: deviceId
            }).expect({
                action: 'command/list',
                status: 'success',
                requestId: requestId
            }).assert(function (result) {
                var commandIds = result.commands.map(function (command) {
                    return command.id;
                });
                var areCommandsInList = commandIds.indexOf(commandId1) >= 0 && commandIds.indexOf(commandId2) >= 0;
                   
                assert.equal(areCommandsInList, true, "Commands with required ids are not in the list");
            }).send(done);
        }

        it('should check if inserted commands are in results', function (done) {
            runTest(clientToken, done);
        });

        it('should fail when using wrong jwt', function (done) {
            clientInvalidToken.params({
                action: 'command/list',
                requestId: getRequestId(),
                deviceId: deviceId
            })
                .expectError(401, 'Unauthorized')
                .send(done);
        });

        it('should fail when using wrong deviceId', function (done) {
            var invalidDeviceId = 'invalid-device-id';
            device.params({
                action: 'command/list',
                requestId: getRequestId(),
                deviceId: invalidDeviceId
            })
                .expectError(404, 'Device with such deviceId = ' + invalidDeviceId + ' not found')
                .send(done);
        });

        it('should fail when no deviceId is provided', function (done) {
            clientToken.params({
                action: 'command/list',
                requestId: getRequestId()
            })
                .expectError(400, 'Device id is wrong or empty')
                .send(done);
        });
    });

    describe('#command/get', function () {

        function runTest(client, done) {
            var requestId = getRequestId();
            client.params({
                action: 'command/get',
                requestId: requestId,
                deviceId: deviceId,
                commandId: commandId1
            })
                .expect({
                    action: 'command/get',
                    status: 'success',
                    requestId: requestId
                })
                .assert(function (result) {
                    assert.equal(result.command.id, commandId1, "Commands with required id is not returned");
                })
                .send(done);
        }

        it('should check if inserted commands are in results', function (done) {
            runTest(clientToken, done);
        });

        it('should fail when using wrong jwt', function (done) {
            clientInvalidToken.params({
                action: 'command/get',
                requestId: getRequestId(),
                deviceId: deviceId,
                commandId: commandId1
            })
                .expectError(401, 'Unauthorized')
                .send(done);
        });

        it('should fail when using wrong deviceId', function (done) {
            var invalidDeviceId = 'invalid-device-id';
            device.params({
                action: 'command/get',
                requestId: getRequestId(),
                deviceId: invalidDeviceId,
                commandId: commandId1
            })
                .expectError(404, 'Device with such deviceId = ' + invalidDeviceId + ' not found')
                .send(done);
        });

        it('should fail when no deviceId is provided', function (done) {
            clientToken.params({
                action: 'command/get',
                requestId: getRequestId(),
                commandId: commandId1
            })
                .expectError(400, 'Device id is wrong or empty')
                .send(done);
        });

        it('should fail when no notificationId is provided', function (done) {
            clientToken.params({
                action: 'command/get',
                requestId: getRequestId(),
                deviceId: deviceId
            })
                .expectError(400, 'Command id is wrong or empty')
                .send(done);
        });

        it('should fail when not integer commandId is provided', function (done) {
            var invalidCommandId = 'invalid-command-id';

            clientToken.params({
                action: 'command/get',
                requestId: getRequestId(),
                deviceId: deviceId,
                notificationId: invalidCommandId
            })
                .expectError(400, 'Command id is wrong or empty')
                .send(done);
        });

        it('should fail when not existing commandId is provided', function (done) {
            var invalidCommandId = 123454321;

            clientToken.params({
                action: 'command/get',
                requestId: getRequestId(),
                deviceId: deviceId,
                commandId: invalidCommandId
            })
                .expectError(404, 'Command with id = ' + invalidCommandId + ' not found')
                .send(done);
        });

    });

    describe('#command/subscribe', function () {

        function runTest(client, ts, done) {
            var requestId = getRequestId();
            var subscriptionId = null;
            var clientParams = null;
            if (ts != null) {
                clientParams = client.params({
                    action: 'command/subscribe',
                    requestId: requestId,
                    deviceIds: [deviceId],
                    names: [COMMAND],
                    timestamp: ts
                });
            } else {
                clientParams = client.params({
                    action: 'command/subscribe',
                    requestId: requestId,
                    deviceIds: [deviceId],
                    names: [COMMAND]
                });
            }
            clientParams.expect({
                action: 'command/subscribe',
                requestId: requestId,
                status: 'success'
            })
                .expectTrue(function (result) {
                    return utils.core.hasStringValue(result.subscriptionId);
                })
                .send(onSubscribed);

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                subscriptionId = result.subscriptionId;
                client.waitFor('command/insert', cleanUp)
                    .expect({
                        action: 'command/insert',
                        command: { command: COMMAND },
                        subscriptionId: subscriptionId
                    });

                req.create(path.COMMAND.get(deviceId))
                    .params({
                        jwt: token,
                        data: {command: COMMAND}
                    })
                    .send();

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    client.params({
                            action: 'command/unsubscribe',
                            requestId: getRequestId(),
                            subscriptionId: subscriptionId
                        })
                        .send(done);
                }
            }
        }

        it('should subscribe to device commands, jwt authorization', function (done) {
            runTest(clientToken, null, done);
        });
        it('should subscribe to device commands with timestamp, jwt authorization', function (done) {
            runTest(clientToken, new Date().toISOString(), done);
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

        function runTest(client, done) {
            var subscriptionId = null;
            client.params({
                    action: 'command/subscribe',
                    requestId: getRequestId(),
                    deviceIds: [deviceId],
                    names: [COMMAND]
                })
                .send(onSubscribed);

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                var requestId = getRequestId();
                subscriptionId = result.subscriptionId;
                client.params({
                        action: 'command/unsubscribe',
                        requestId: requestId,
                        subscriptionId: subscriptionId
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

                client.waitFor('command/insert', function (err) {
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
        }

        it('should unsubscribe to device commands, jwt authorization', function (done) {
            runTest(clientToken, done);
        });
    });

    describe('#command/update', function () {

        function runTest(client, done) {
            var commandId = null;

            var update = {
                command: COMMAND + '-UPD',
                parameters: {a: '1', b: '2'},
                lifetime: 100500,
                status: 'Updated',
                result: {done: 'yes'}
            };

            client.params({
                    action: 'command/insert',
                    requestId: getRequestId(),
                    deviceId: deviceId,
                    command: {
                        command: COMMAND,
                        lifetime: 500,
                        status: 'Inserted'
                    }
                })
                .send(onCommandCreated);

            function onCommandCreated(err, result) {
                if (err) {
                    return done(err);
                }

                var requestId = getRequestId();
                commandId = result.command.id;
                client.params({
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
                    .send(onCommandUpdated);
            }

            function onCommandUpdated(err) {
                if (err) {
                    return done(err);
                }

                req.get(path.COMMAND.get(deviceId))
                    .params({jwt: utils.jwt.admin, id: commandId})
                    .expect({id: commandId})
                    .expect(update)
                    .send(done);
            }
        }

        it('should update existing command, jwt auth', function (done) {
            runTest(clientToken, done);
        });
    });

    describe('#srv: command/insert', function () {

        function runTest(client, done) {

            var subscriptionId = null;
            var command = {
                command: COMMAND,
                parameters: {a: '1', b: '2'},
                lifetime: 100500,
                status: 'Inserted',
                result: {done: 'yes'}
            };

            client.params({
                    action: 'command/subscribe',
                    requestId: getRequestId(),
                    deviceIds: [deviceId],
                    names: [COMMAND]
                })
                .send(onSubscribed);

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                subscriptionId = result.subscriptionId;
                client.waitFor('command/insert', cleanUp)
                    .expect({
                        action: 'command/insert',
                        command: command,
                        subscriptionId: subscriptionId
                    });

                req.create(path.COMMAND.get(deviceId))
                    .params({
                        jwt: token,
                        data: command
                    })
                    .send();

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    client.params({
                            action: 'command/unsubscribe',
                            requestId: getRequestId(),
                            subscriptionId: subscriptionId
                        })
                        .send(done);
                }
            }
        }

        it('should notify when command was inserted, jwt auth', function (done) {
            setTimeout(function () {
                runTest(clientToken, done);
            }, 500);
        });

        function runTestNoSubscr(client, done) {

            var command = {
                command: COMMAND,
                parameters: {a: '3', b: '4'},
                lifetime: 500100,
                status: 'Inserted',
                result: {done: 'yes'}
            };

            client.waitFor('command/insert', function (err) {
                assert.strictEqual(!(!err), true, 'Commands should not arrive');
                utils.matches(err, {message: 'waitFor() timeout: hasn\'t got message \'command/insert\' for 2000ms'});
                done();
            });

            req.create(path.COMMAND.get(deviceId))
                .params({
                    jwt: token,
                    data: command
                })
                .send();
        }

        it('should not notify when command was inserted without prior subscription, jwt auth', function (done) {
            runTestNoSubscr(clientToken, done);
        });
    });

    describe('#srv: command/update', function () {

        function runTest(client, done) {
            var commandId = null;

            var update = {
                command: COMMAND + '-UPD',
                parameters: {a: '1', b: '2'},
                lifetime: 100500,
                status: 'Updated',
                result: {done: 'yes'}
            };

            client.params({
                    action: 'command/insert',
                    requestId: getRequestId(),
                    deviceId: deviceId,
                    command: {
                        command: COMMAND,
                        lifetime: 500,
                        status: 'Inserted'
                    }
                })
                .send(onCommandCreated);

            function onCommandCreated(err, result) {
                if (err) {
                    return done(err);
                }

                var requestId = getRequestId();
                commandId = result.command.id;
                client.params({
                        action: 'command/update',
                        requestId: requestId,
                        deviceId: deviceId,
                        commandId: commandId,
                        command: update
                    })
                    .send(onCommandUpdated);
            }

            function onCommandUpdated(err) {
                if (err) {
                    return done(err);
                }

                client.waitFor('command/update', done)
                    .expect({
                        action: 'command/update',
                        command: {id: commandId}
                    })
                    .expect({command: update});
            }
        }

        it('should notify when command was updated, jwt auth', function (done) {
            runTest(clientToken, done);
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
        clientToken.close();
        utils.clearDataJWT(done);
    });
});
