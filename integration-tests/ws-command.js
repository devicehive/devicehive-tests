var async = require('async');
var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var status = require('./common/http').status;
var format = require('util').format;
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API Command', function () {
    this.timeout(90000);
    var url = null;

    var DEVICE = utils.getName('ws-cmd-device');
    var NETWORK = utils.getName('ws-cmd-network');
    var NETWORK_KEY = utils.getName('ws-cmd-network-key');
    var DEVICE_1 = utils.getName('ws-cmd-device-1');
    var NETWORK_1 = utils.getName('ws-cmd-network-1');
    var NETWORK_KEY_1 = utils.getName('ws-cmd-network-key-1');

    var COMMAND = utils.getName('ws-command');
    var COMMAND1 = utils.getName('ws-command-1');
    var COMMAND2 = utils.getName('ws-command-2');

    var deviceId = utils.getName('ws-cmd-device-id');
    var deviceId1 = utils.getName('ws-cmd-device-id-1');
    var newDeviceId = utils.getName('ws-cmd-device-id-new');
    var user = null;
    var token = null;
    var invalidToken = null;
    var networkId = null;
    var networkId1 = null;
    var commandId1 = null;
    var commandId2 = null;

    var conn = null;
    var adminConn = null;
    var connInvalidToken = null;
    var startTestTimestamp = null;

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

        function createNetwork1(callback) {
            var params = {
                jwt: utils.jwt.admin,
                data: { name: NETWORK_1, key: NETWORK_KEY_1 }
            };

            utils.create(path.NETWORK, params, function (err, result) {
                if (err) {
                    return callback(err);
                }

                networkId1 = result.id;
                callback();
            });
        }

        function createUser(callback) {
            utils.createUser2(1, [networkId, networkId1], function (err, result) {
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

        function createDevice1(callback) {
            req.update(path.get(path.DEVICE, deviceId1))
                .params(utils.device.getParamsObj(DEVICE_1, utils.jwt.admin,
                    networkId1, {name: DEVICE_1, version: '1'}))
                .send(callback);
        }

        function createToken(callback) {
            var args = {
                actions: [
                    'RegisterDevice',
                    'GetDeviceCommand',
                    'CreateDeviceCommand',
                    'UpdateDeviceCommand'
                ],
                networkIds: [networkId],
                deviceTypeIds: [1]
            };
            utils.jwt.create(user.id, args.actions, args.networkIds, args.deviceTypeIds, function (err, result) {
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
                networkIds: [networkId, networkId1],
                deviceTypeIds: [1]
            };
            utils.jwt.create(user.id, args.actions, args.networkIds, args.deviceTypeIds, function (err, result) {
                if (err) {
                    return callback(err);
                }
                invalidToken = result.accessToken;
                callback()
            })
        }

        function createConn(callback) {
            conn = new Websocket(url);
            conn.connect(callback);
        }

        function createAdminConn(callback) {
            adminConn = new Websocket(url);
            adminConn.connect(callback);
        }

        function createConnInvalidTokenAuth(callback) {
            connInvalidToken = new Websocket(url);
            connInvalidToken.connect(callback);
        }
        
        function authenticateConn(callback) {
            conn.params({
                action: 'authenticate',
                requestId: getRequestId(),
                token: token
            })
                .send(callback);
        }

        function authenticateAdminConn(callback) {
            adminConn.params({
                action: 'authenticate',
                requestId: getRequestId(),
                token: utils.jwt.admin
            })
                .send(callback);
        }
        
        function authenticateWithInvalidToken(callback) {
            connInvalidToken.params({
                action: 'authenticate',
                requestId: getRequestId(),
                token: invalidToken
            })
                .send(callback);
        }

        async.series([
            getWsUrl,
            createNetwork,
            createNetwork1,
            createUser,
            createDevice,
            createDevice1,
            createToken,
            createInvalidToken,
            createConn,
            createAdminConn,
            createConnInvalidTokenAuth,
            authenticateConn,
            authenticateAdminConn,
            authenticateWithInvalidToken
        ], done);
    });
    
    describe('#Invalid credentials', function(done) {
        it('should return error with refresh token', function() {
            conn.params({
                action: 'authenticate',
                requestId: getRequestId(),
                token: utils.jwt.admin_refresh
            })
                .expectError(401, 'Invalid credentials')
                .assert(function (result) {
                    utils.hasPropsWithValues(result.notification, ['action', 'requestId', 'code', 'status', 'error']);
                })
                .send(done);
        });
    });

    describe('#command/insert', function () {

        var command = {
            command: COMMAND,
            status: 'in progress'
        };

        it('should add new command, jwt auth', function (done) {
            var requestId = getRequestId();
            adminConn.params({
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
                    utils.hasPropsWithValues(result.command, ['id', 'timestamp', 'lastUpdated', 'userId']);
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
        });

        it('should fail when using wrong jwt', function (done) {
            connInvalidToken.params({
                    action: 'command/insert',
                    requestId: getRequestId(),
                    deviceId: deviceId,
                    command: command
                })
                .expectError(403, 'Access is denied')
                .send(done);
        });

        it('should fail when using wrong deviceId with ', function (done) {
            var invalidDeviceId = 'invalid-device-id';
            conn.params({
                    action: 'command/insert',
                    requestId: getRequestId(),
                    deviceId: invalidDeviceId,
                    command: command
                })
                .expectError(403, 'Access is denied')
                .send(done);
        });
        
    });

    describe('#command/list', function () {
        
        var timestamp = null;

        before(function (done) {
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
                    timestamp = new Date().getTime();
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

            async.series([
                insertCommand1,
                insertCommand2
            ], done);

        });

        it('should check if inserted commands are in results', function (done) {
            var requestId = getRequestId();
            
            conn.params({
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
        });

        it('should check if start timestamp limits commands in results', function (done) {
            var requestId = getRequestId();

            conn.params({
                action: 'command/list',
                requestId: requestId,
                start: timestamp,
                deviceId: deviceId
            }).expect({
                action: 'command/list',
                status: 'success',
                requestId: requestId
            }).assert(function (result) {
                var commandIds = result.commands.map(function (command) {
                    return command.id;
                });
                var areCommandsInList = commandIds.indexOf(commandId1) < 0 && commandIds.indexOf(commandId2) >= 0;

                assert.equal(areCommandsInList, true, "Commands with required ids are not in the list:" + commandIds);
            }).send(done);
        });

        it('should check if command with correct name is in results', function (done) {
            var requestId = getRequestId();

            conn.params({
                action: 'command/list',
                requestId: requestId,
                command: COMMAND2,
                deviceId: deviceId
            }).expect({
                action: 'command/list',
                status: 'success',
                requestId: requestId
            }).assert(function (result) {
                var commandIds = result.commands.map(function (command) {
                    return command.id;
                });
                var areCommandsInList = commandIds.indexOf(commandId1) < 0 && commandIds.indexOf(commandId2) >= 0;

                assert.equal(areCommandsInList, true, "Commands with required ids are not in the list");
            }).send(done);
        });

        it('should fail when using wrong jwt', function (done) {
            connInvalidToken.params({
                action: 'command/list',
                requestId: getRequestId(),
                deviceId: deviceId
            })
                .expectError(403, 'Access is denied')
                .send(done);
        });

        it('should fail when using wrong deviceId with client token', function (done) {
            var invalidDeviceId = 'invalid-device-id';
            conn.params({
                action: 'command/list',
                requestId: getRequestId(),
                deviceId: invalidDeviceId
            })
                .expectError(403, 'Access is denied')
                .send(done);
        });

        it('should fail when using wrong deviceId with admin token', function (done) {
            var invalidDeviceId = 'invalid-device-id';
            adminConn.params({
                action: 'command/list',
                requestId: getRequestId(),
                deviceId: invalidDeviceId
            })
                .expectError(404, 'Device with such deviceId = ' + invalidDeviceId + ' not found')
                .send(done);
        });

        it('should fail when no deviceId is provided', function (done) {
            conn.params({
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
                    assert.equal(result.command.networkId, networkId, "Commands with networkId is not returned");
                })
                .send(done);
        }

        it('should check if inserted commands are in results', function (done) {
            runTest(conn, done);
        });

        it('should fail when using wrong jwt', function (done) {
            connInvalidToken.params({
                action: 'command/get',
                requestId: getRequestId(),
                deviceId: deviceId,
                commandId: commandId1
            })
                .expectError(403, 'Access is denied')
                .send(done);
        });

        it('should fail when using wrong deviceId with client token', function (done) {
            var invalidDeviceId = 'invalid-device-id';
            conn.params({
                action: 'command/get',
                requestId: getRequestId(),
                deviceId: invalidDeviceId,
                commandId: commandId1
            })
                .expectError(403, 'Access is denied')
                .send(done);
        });

        it('should fail when using wrong deviceId with admin token', function (done) {
            var invalidDeviceId = 'invalid-device-id';
            adminConn.params({
                action: 'command/get',
                requestId: getRequestId(),
                deviceId: invalidDeviceId,
                commandId: commandId1
            })
                .expectError(404, 'Device with such deviceId = ' + invalidDeviceId + ' not found')
                .send(done);
        });

        it('should fail when no deviceId is provided', function (done) {
            conn.params({
                action: 'command/get',
                requestId: getRequestId(),
                commandId: commandId1
            })
                .expectError(400, 'Device id is wrong or empty')
                .send(done);
        });

        it('should fail when no notificationId is provided', function (done) {
            conn.params({
                action: 'command/get',
                requestId: getRequestId(),
                deviceId: deviceId
            })
                .expectError(400, 'Command id is wrong or empty')
                .send(done);
        });

        it('should fail when not integer commandId is provided', function (done) {
            var invalidCommandId = 'invalid-command-id';

            conn.params({
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

            conn.params({
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
        
        startTestTimestamp = new Date().toISOString();
        
        before(function (done) {
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

            async.series([
                insertCommand1,
                insertCommand2
            ], done);
            
        });

        function runTest(client, ts, done) {
            var requestId = getRequestId();
            var subscriptionId = null;
            var clientParams = null;
            if (ts != null) {
                clientParams = client.params({
                    action: 'command/subscribe',
                    requestId: requestId,
                    deviceId: deviceId,
                    names: [COMMAND],
                    timestamp: ts
                });
            } else {
                clientParams = client.params({
                    action: 'command/subscribe',
                    requestId: requestId,
                    deviceId: deviceId,
                    names: [COMMAND]
                });
            }
            clientParams.expect({
                action: 'command/subscribe',
                requestId: requestId,
                status: 'success'
            })
                .expectTrue(function (result) {
                    return utils.core.hasNumericValue(result.subscriptionId);
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

        function runTestWithUpdatedCommands(client, ts, done) {
            var requestId = getRequestId();
            var subscriptionId = null;
            var clientParams = null;
            if (ts != null) {
                clientParams = client.params({
                    action: 'command/subscribe',
                    requestId: requestId,
                    deviceId: deviceId,
                    returnUpdatedCommands: true,
                    names: [COMMAND],
                    timestamp: ts
                });
            } else {
                clientParams = client.params({
                    action: 'command/subscribe',
                    requestId: requestId,
                    deviceId: deviceId,
                    returnUpdatedCommands: true,
                    names: [COMMAND]
                });
            }
            clientParams.expect({
                action: 'command/subscribe',
                requestId: requestId,
                status: 'success'
            })
                .expectTrue(function (result) {
                    return utils.core.hasNumericValue(result.subscriptionId);
                })
                .send(onSubscribed);

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                subscriptionId = result.subscriptionId;
                client.waitFor('command/update', cleanUp)
                    .expect({
                        action: 'command/update',
                        command: {command: COMMAND},
                        subscriptionId: subscriptionId
                    });

                req.create(path.COMMAND.get(deviceId))
                    .params({
                        jwt: token,
                        data: {command: COMMAND}
                    })
                    .send(function(err, result) {
                        if (err) {
                            return done(err);
                        }
                        
                        req.update(path.combine(path.COMMAND.get(deviceId), result.id))
                            .params({
                                jwt: token,
                                data: {command: COMMAND}
                            }).send();
                    });

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }
                    
                    var requestId = getRequestId();

                    client.params({
                        action: 'command/unsubscribe',
                        requestId: requestId,
                        subscriptionId: subscriptionId
                    }).expect({
                        action: 'command/unsubscribe',
                        requestId: requestId
                    }).send(done);
                }
            }
        }

        it('should subscribe to device commands, no returnUpdated, jwt authorization', function (done) {
            runTest(conn, null, done);
        });

        it('should subscribe to non existing device commands, no returnUpdated, client jwt authorization', function (done) {
            var requestId = getRequestId();
            conn.params({
                action: 'command/subscribe',
                requestId: requestId,
                deviceId: utils.NON_EXISTING_ID,
                names: [COMMAND]
            })
                .expectError(status.FORBIDDEN, 'Access is denied')
                .send(done);
        });

        it('should subscribe to non existing device commands, no returnUpdated, admin jwt authorization', function (done) {
            var requestId = getRequestId();
            adminConn.params({
                action: 'command/subscribe',
                requestId: requestId,
                deviceId: utils.NON_EXISTING_ID,
                names: [COMMAND]
            })
                .expectError(status.NOT_FOUND, 
                    format('Device with such deviceId = %d not found', utils.NON_EXISTING_ID))
                .send(done);
        });
        
        it('should subscribe to device commands with timestamp, no returnUpdated, jwt authorization', function (done) {
            runTest(conn, new Date().toISOString(), done);
        });

        it('should subscribe to device commands for single device, no returnUpdated,', function (done) {
            var requestId = getRequestId();

            conn.params({
                action: 'command/subscribe',
                deviceId: deviceId,
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

                conn.waitFor('command/insert', cleanUp)
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
                    
                    var requestId = getRequestId();

                    conn.params({
                        action: 'command/unsubscribe',
                        requestId: requestId
                    }).expect({
                        action: 'command/unsubscribe',
                        requestId: requestId
                    })
                        .send(done);
                }
            }
        });

        it('should subscribe to device commands, returnUpdated=true, jwt authorization', function (done) {
            runTestWithUpdatedCommands(conn, null, done);
        });

        it('should subscribe to device commands with timestamp, returnUpdated = true, jwt authorization', function (done) {
            runTestWithUpdatedCommands(conn, new Date().toISOString(), done);
        });

        it('should subscribe to device commands for single device, returnUpdated = true', function (done) {
            var requestId = getRequestId();

            conn.params({
                action: 'command/subscribe',
                deviceId: deviceId,
                returnUpdatedCommands: true,
                requestId: requestId
            })
                .expect({
                    action: 'command/subscribe',
                    requestId: requestId,
                    status: 'success'
                })
                .send(onSubscribed);

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                var subscriptionId = result.subscriptionId;
                conn.waitFor('command/update', cleanUp)
                    .expect({
                        action: 'command/update',
                        command: { command: COMMAND }
                    });

                req.create(path.COMMAND.get(deviceId))
                    .params({
                        jwt: utils.jwt.admin,
                        data: {command: COMMAND}
                    })
                    .send(function(err, result) {
                        if (err) {
                            return done(err);
                        }

                        req.update(path.combine(path.COMMAND.get(deviceId), result.id))
                            .params({
                                jwt: token,
                                data: {command: COMMAND}
                            }).send();
                    });

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    conn.params({
                        action: 'command/unsubscribe',
                        requestId: getRequestId(),
                        subscriptionId: subscriptionId
                    })
                        .send(done);
                }
            }
        });

        it('should subscribe to device commands for single network, returnUpdated = true', function (done) {
            var requestId = getRequestId();

            conn.params({
                action: 'command/subscribe',
                networkIds: [networkId],
                returnUpdatedCommands: true,
                requestId: requestId
            })
                .expect({
                    action: 'command/subscribe',
                    requestId: requestId,
                    status: 'success'
                })
                .send(onSubscribed);

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                var subscriptionId = result.subscriptionId;
                conn.waitFor('command/update', cleanUp)
                    .expect({
                        action: 'command/update',
                        command: { command: COMMAND }
                    });

                req.create(path.COMMAND.get(deviceId))
                    .params({
                        jwt: utils.jwt.admin,
                        data: {command: COMMAND}
                    })
                    .send(function(err, result) {
                        if (err) {
                            return done(err);
                        }

                        req.update(path.combine(path.COMMAND.get(deviceId), result.id))
                            .params({
                                jwt: token,
                                data: {command: COMMAND}
                            }).send();
                    });

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    conn.params({
                        action: 'command/unsubscribe',
                        requestId: getRequestId(),
                        subscriptionId: subscriptionId
                    })
                        .send(done);
                }
            }
        });

        it('should subscribe to device commands for multiple networks, returnUpdated = true', function (done) {
            var requestId = getRequestId();

            adminConn.params({
                action: 'command/subscribe',
                networkIds: [networkId, networkId1],
                returnUpdatedCommands: true,
                requestId: requestId
            })
                .expect({
                    action: 'command/subscribe',
                    requestId: requestId,
                    status: 'success'
                })
                .send(onSubscribed);

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                var subscriptionId = result.subscriptionId;
                adminConn.waitFor('command/update', cleanUp)
                    .expect({
                        action: 'command/update',
                        command: { command: COMMAND }
                    });

                req.create(path.COMMAND.get(deviceId))
                    .params({
                        jwt: utils.jwt.admin,
                        data: {command: COMMAND}
                    })
                    .send(function(err, result) {
                        if (err) {
                            return done(err);
                        }

                        req.update(path.combine(path.COMMAND.get(deviceId), result.id))
                            .params({
                                jwt: token,
                                data: {command: COMMAND}
                            }).send();
                    });

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    adminConn.params({
                        action: 'command/unsubscribe',
                        requestId: getRequestId(),
                        subscriptionId: subscriptionId
                    })
                        .send(done);
                }
            }
        });

        it('should subscribe to recently created device commands for multiple networks', function (done) {
            var requestId = getRequestId();
            var subscriptionId = null;

            adminConn.params({
                action: 'command/subscribe',
                networkIds: [networkId, networkId1],
                requestId: requestId
            })
                .expect({
                    action: 'command/subscribe',
                    requestId: requestId,
                    status: 'success'
                })
                .send(deviceCreate);

            function deviceCreate(err, result) {
                if (err) {
                    return done(err);
                }

                subscriptionId = result.subscriptionId;

                adminConn.params({
                    action: 'device/save',
                    requestId: requestId,
                    deviceId: newDeviceId,
                    device: {
                        name: newDeviceId,
                        networkId: networkId
                    }
                })
                    .expect({
                        action: 'device/save',
                        requestId: requestId,
                        status: 'success'
                    })
                    .send(onSubscribed);
            }

            function onSubscribed(err) {
                if (err) {
                    return done(err);
                }

                adminConn.waitFor('command/insert', cleanUp)
                    .expect({
                        action: 'command/insert',
                        command: { command: COMMAND },
                        subscriptionId: subscriptionId
                    });

                req.create(path.COMMAND.get(newDeviceId))
                    .params({
                        jwt: utils.jwt.admin,
                        data: {command: COMMAND}
                    })
                    .send();
                    

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    adminConn.params({
                        action: 'device/delete',
                        requestId: requestId,
                        deviceId: newDeviceId
                    })
                        .expect({
                            action: 'device/delete',
                            requestId: requestId,
                            status: 'success'
                        })
                        .send(function () {
                            adminConn.params({
                                action: 'command/unsubscribe',
                                requestId: getRequestId(),
                                subscriptionId: subscriptionId
                            })
                                .send(done);        
                        });

                    
                }
            }
        });

        it('should subscribe to recently created device commands for global subscription', function (done) {
            var requestId = getRequestId();
            var subscriptionId = null;

                conn.params({
                action: 'command/subscribe',
                requestId: requestId
            })
                .expect({
                    action: 'command/subscribe',
                    requestId: requestId,
                    status: 'success'
                })
                .send(deviceCreate);

            function deviceCreate(err, result) {
                if (err) {
                    return done(err);
                }
                subscriptionId = result.subscriptionId;

                conn.params({
                    action: 'device/save',
                    requestId: requestId,
                    deviceId: newDeviceId,
                    device: {
                        name: newDeviceId,
                        networkId: networkId
                    }
                })
                    .expect({
                        action: 'device/save',
                        requestId: requestId,
                        status: 'success'
                    })
                    .send(onSubscribed);
            }

            function onSubscribed(err) {
                if (err) {
                    return done(err);
                }


                conn.waitFor('command/insert', cleanUp)
                    .expect({
                        action: 'command/insert',
                        command: { command: COMMAND },
                        subscriptionId: subscriptionId
                    });

                req.create(path.COMMAND.get(newDeviceId))
                    .params({
                        jwt: utils.jwt.admin,
                        data: {command: COMMAND}
                    })
                    .send();
                
                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    conn.params({
                        action: 'device/delete',
                        requestId: requestId,
                        deviceId: newDeviceId
                    })
                        .expect({
                            action: 'device/delete',
                            requestId: requestId,
                            status: 'success'
                        })
                        .send(function () {
                            conn.params({
                                action: 'command/unsubscribe',
                                requestId: getRequestId(),
                                subscriptionId: subscriptionId
                            })
                                .send(done);        
                        });

                    
                }
            }
        });

        it('should subscribe to recently created device commands for global subscription, returnUpdated = true', function (done) {
            var requestId = getRequestId();
            var subscriptionId = null;

            conn.params({
                action: 'command/subscribe',
                returnUpdatedCommands: true,
                requestId: requestId
            })
                .expect({
                    action: 'command/subscribe',
                    requestId: requestId,
                    status: 'success'
                })
                .send(deviceCreate);

            function deviceCreate(err, result) {
                if (err) {
                    return done(err);
                }
                subscriptionId = result.subscriptionId;

                conn.params({
                    action: 'device/save',
                    requestId: requestId,
                    deviceId: newDeviceId,
                    device: {
                        name: newDeviceId,
                        networkId: networkId
                    }
                })
                    .expect({
                        action: 'device/save',
                        requestId: requestId,
                        status: 'success'
                    })
                    .send(onSubscribed);
            }

            function onSubscribed(err) {
                if (err) {
                    return done(err);
                }


                conn.waitFor('command/update', cleanUp)
                    .expect({
                        action: 'command/update',
                        command: { command: COMMAND },
                        subscriptionId: subscriptionId
                    });

                req.create(path.COMMAND.get(deviceId))
                    .params({
                        jwt: utils.jwt.admin,
                        data: {command: COMMAND}
                    })
                    .send(function(err, result) {
                        if (err) {
                            return done(err);
                        }

                        req.update(path.combine(path.COMMAND.get(deviceId), result.id))
                            .params({
                                jwt: token,
                                data: {command: COMMAND}
                            }).send();
                    });

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    var requestId = getRequestId();

                    conn.params({
                        action: 'device/delete',
                        requestId: requestId,
                        deviceId: newDeviceId
                    })
                        .expect({
                            action: 'device/delete',
                            requestId: requestId,
                            status: 'success'
                        })
                        .send(function () {
                            var requestId = getRequestId();
                                                        conn.params({
                                action: 'command/unsubscribe',
                                requestId: requestId,
                                subscriptionId: subscriptionId
                            }).expect({
                                action: 'command/unsubscribe',
                                requestId: requestId
                            }).send(done);
                        });
                }
            }
        });

        it('should not subscribe to recently created device in different network for network subscription', function (done) {
            var requestId = getRequestId();

            adminConn.params({
                action: 'command/subscribe',
                networkIds: [networkId1],
                requestId: requestId
            })
                .expect({
                    action: 'command/subscribe',
                    requestId: requestId,
                    status: 'success'
                })
                .send(deviceCreate);

            function deviceCreate(err) {
                if (err) {
                    return done(err);
                }

                adminConn.params({
                    action: 'device/save',
                    requestId: requestId,
                    deviceId: newDeviceId,
                    device: {
                        name: newDeviceId,
                        networkId: networkId
                    }
                })
                    .expect({
                        action: 'device/save',
                        requestId: requestId,
                        status: 'success'
                    })
                    .send(onSubscribed);
            }

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                var subscriptionId = result.subscriptionId;

                conn.waitFor('command/insert', function (err) {
                    assert.strictEqual(!(!err), true, 'Commands should not arrive');
                    utils.matches(err, {message: 'waitFor() timeout: hasn\'t got message \'command/insert\' for ' + utils.WEBSOCKET_TIMEOUT + 'ms'});
                    cleanUp();
                });

                req.create(path.COMMAND.get(newDeviceId))
                    .params({
                        jwt: utils.jwt.admin,
                        data: {command: COMMAND}
                    })
                
                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    conn.params({
                        action: 'device/delete',
                        requestId: requestId,
                        deviceId: newDeviceId
                    })
                        .expect({
                            action: 'device/delete',
                            requestId: requestId,
                            status: 'success'
                        })
                        .send(function () {
                                var requestId = getRequestId();
                                conn.params({
                                    action: 'command/unsubscribe',
                                    requestId: requestId,
                                    subscriptionId: subscriptionId
                                }).expect({
                                    action: 'command/unsubscribe',
                                    requestId: requestId
                                }).send(done);        
                        });

                    
                }
            }
        });

        it('should reject subscribe to device commands for non existing network, returnUpdated = true', function (done) {
            var requestId = getRequestId();

            conn.params({
                action: 'command/subscribe',
                networkIds: [utils.NON_EXISTING_ID],
                returnUpdatedCommands: true,
                requestId: requestId
            })
                .expectError(403, "Networks with such networkIds wasn't found: {[" + utils.NON_EXISTING_ID + "]}")
                .send(done);
        });

    });

    describe('#command/unsubscribe', function () {

        function runTest(client, done) {
            var subscriptionId = null;
            client.params({
                    action: 'command/subscribe',
                    requestId: getRequestId(),
                    deviceId: deviceId,
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

            function onUnubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                client.waitFor('command/insert', function (err) {
                    assert.strictEqual(!(!err), true, 'Commands should not arrive');
                    utils.matches(err, {message: 'waitFor() timeout: hasn\'t got message \'command/insert\' for ' + utils.WEBSOCKET_TIMEOUT + 'ms'});
                    done();
                });

                req.create(path.COMMAND.get(deviceId))
                    .params({
                        jwt: utils.jwt.admin,
                        data: {command: COMMAND}
                    }).send();
            }
        }

        it('should unsubscribe to device commands, jwt authorization', function (done) {
            runTest(conn, done);
        });

    });

    describe('#command/update', function () {

        function runTest(client, done) {
            var commandId = null;

            var update = {
                command: COMMAND + '-UPD',
                status: 'Updated',
                result: {done: 'yes'}
            };

            var expectedUpdate = {
                command: COMMAND,
                lifetime: 500,
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
                    .expect(expectedUpdate)
                    .send(done);
            }
        }

        it('should update existing command, jwt auth', function (done) {
            runTest(conn, done);
        });

        it('should fail when no deviceId is provided', function (done) {
            conn.params({
                action: 'command/update',
                requestId: getRequestId(),
                deviceId: null,
                commandId: commandId1,
                command: {command: COMMAND}
            })
                .expectError(400, 'Device id is wrong or empty')
                .send(done);
        });

        it('should fail when using wrong deviceId', function (done) {
            var invalidDeviceId = 'invalid-device-id';
            conn.params({
                    action: 'command/update',
                    requestId: getRequestId(),
                    deviceId: invalidDeviceId,
                    commandId: commandId1,
                    command: { command: COMMAND }
                })
                .expectError(403, 'Access is denied')
                .send(done);
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
            runTest(conn, done);
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
                utils.matches(err, {message: 'waitFor() timeout: hasn\'t got message \'command/insert\' for ' + utils.WEBSOCKET_TIMEOUT + 'ms'});
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
            runTestNoSubscr(conn, done);
        });

        it('should notify when command was inserted, device auth', function (done) {
            runTest(conn, done);
        });

        it('should not notify when command was inserted without prior subscription, device auth', function (done) {
            runTestNoSubscr(conn, done);
        });
    });

    describe('#srv: command/update', function () {

        function runTest(client, done) {
            var commandId = null;

            var update = {
                command: COMMAND + '-UPD',
                parameters: {a: '1', b: '2'},
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
                        status: 'success'
                    })
                    .send(done);
            }

        }

        it('should notify when command was updated, jwt auth', function (done) {
            runTest(conn, done);
        });
    });

    after(function (done) {
        conn.close();
        connInvalidToken.close();
        utils.clearDataJWT(done);
    });
});
