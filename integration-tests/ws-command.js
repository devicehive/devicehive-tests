var async = require('async');
var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var status = require('./common/http').status;
var format = require('util').format;
var Websocket = require('./common/ws');
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
            req.get(path.INFO).params({ jwt: utils.jwt.admin }).send(function (err, result) {
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
                    networkId, { name: DEVICE, version: '1' }))
                .send(callback);
        }

        function createDevice1(callback) {
            req.update(path.get(path.DEVICE, deviceId1))
                .params(utils.device.getParamsObj(DEVICE_1, utils.jwt.admin,
                    networkId1, { name: DEVICE_1, version: '1' }))
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
                actions: ['GetNetwork'],
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
            conn.on({
                action: 'authenticate',
                status: 'success'
            }, callback);

            conn.send({
                action: 'authenticate',
                requestId: getRequestId(),
                token: token
            });
        }

        function authenticateAdminConn(callback) {
            adminConn.on({
                action: 'authenticate',
                status: 'success'
            }, callback);

            adminConn.send({
                action: 'authenticate',
                requestId: getRequestId(),
                token: utils.jwt.admin
            });
        }

        function authenticateWithInvalidToken(callback) {

            connInvalidToken.on({}, callback);

            connInvalidToken.send({
                action: 'authenticate',
                requestId: getRequestId(),
                token: invalidToken
            });
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

    describe('#Invalid credentials', function () {
        it('should return error with refresh token', function (done) {
            conn.on({
                code: 401,
                error: 'Invalid credentials'
            }, (err, result) => {
                utils.hasPropsWithValues(result, ['action', 'requestId', 'code', 'status', 'error']);
                done();
            });

            conn.send({
                action: 'authenticate',
                requestId: getRequestId(),
                token: utils.jwt.admin_refresh
            });
        });
    });

    describe('#command/insert', function () {

        var command = {
            command: COMMAND,
            status: 'in progress'
        };

        it('should add new command, jwt auth', function (done) {
            var requestId = getRequestId();

            adminConn.on({
                action: 'command/insert',
                status: 'success',
                requestId: requestId
            }, (err, result) => {
                utils.hasPropsWithValues(result.command, ['id', 'timestamp', 'lastUpdated', 'userId']);
                onInsert(err, result);
            });

            adminConn.send({
                action: 'command/insert',
                requestId: requestId,
                deviceId: deviceId,
                command: command
            });

            function onInsert(err, result) {
                if (err) {
                    return done(err);
                }

                var commandId = result.command.id;
                req.get(path.COMMAND.get(deviceId))
                    .params({ jwt: utils.jwt.admin, id: commandId })
                    .expect({ id: commandId })
                    .expect(command)
                    .send(done);
            }
        });

        it('should fail when using wrong jwt', function (done) {
            connInvalidToken.on({
                code: 403,
                error: 'Access is denied'
            }, done)
            connInvalidToken.send({
                action: 'command/insert',
                requestId: getRequestId(),
                deviceId: deviceId,
                command: command
            });
        });

        it('should fail when using wrong deviceId with ', function (done) {
            var invalidDeviceId = 'invalid-device-id';

            conn.on({
                code: 403,
                error: 'Access is denied'
            }, done);

            conn.send({
                action: 'command/insert',
                requestId: getRequestId(),
                deviceId: invalidDeviceId,
                command: command
            });
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

            conn.on({
                action: 'command/list',
                status: 'success',
                requestId: requestId
            }, (err, result) => {
                var commandIds = result.commands.map(function (command) {
                    return command.id;
                });
                var areCommandsInList = commandIds.indexOf(commandId1) >= 0 && commandIds.indexOf(commandId2) >= 0;

                assert.equal(areCommandsInList, true, "Commands with required ids are not in the list");
                done();
            });

            conn.send({
                action: 'command/list',
                requestId: requestId,
                deviceId: deviceId
            });
        });

        it('should check if start timestamp limits commands in results', function (done) {
            var requestId = getRequestId();

            conn.on({
                action: 'command/list',
                status: 'success',
                requestId: requestId
            }, (err, result) => {
                var commandIds = result.commands.map(function (command) {
                    return command.id;
                });
                var areCommandsInList = commandIds.indexOf(commandId1) < 0 && commandIds.indexOf(commandId2) >= 0;

                assert.equal(areCommandsInList, true, "Commands with required ids are not in the list:" + commandIds);
                done();
            });

            conn.send({
                action: 'command/list',
                requestId: requestId,
                start: timestamp,
                deviceId: deviceId
            });
        });

        it('should check if command with correct name is in results', function (done) {
            var requestId = getRequestId();

            conn.on({
                action: 'command/list',
                status: 'success',
                requestId: requestId
            }, (err, result) => {
                var commandIds = result.commands.map(function (command) {
                    return command.id;
                });
                var areCommandsInList = commandIds.indexOf(commandId1) < 0 && commandIds.indexOf(commandId2) >= 0;

                assert.equal(areCommandsInList, true, "Commands with required ids are not in the list");
                done();
            });

            conn.send({
                action: 'command/list',
                requestId: requestId,
                command: COMMAND2,
                deviceId: deviceId
            });
        });

        it('should fail when using wrong jwt', function (done) {
            connInvalidToken.on({
                code: 403,
                error: 'Access is denied'
            }, done);

            connInvalidToken.send({
                action: 'command/list',
                requestId: getRequestId(),
                deviceId: deviceId
            });
        });

        it('should fail when using wrong deviceId with client token', function (done) {
            var invalidDeviceId = 'invalid-device-id';

            conn.on({
                code: 403,
                error: 'Access is denied'
            }, done);

            conn.send({
                action: 'command/list',
                requestId: getRequestId(),
                deviceId: invalidDeviceId
            });
        });

        it('should fail when using wrong deviceId with admin token', function (done) {
            var invalidDeviceId = 'invalid-device-id';

            adminConn.on({
                code: 404,
                error: `Device with such deviceId = ${invalidDeviceId} not found`
            }, done);

            adminConn.send({
                action: 'command/list',
                requestId: getRequestId(),
                deviceId: invalidDeviceId
            });
        });

        it('should fail when no deviceId is provided', function (done) {
            conn.on({
                code: 400,
                error: 'Device id is wrong or empty'
            }, done);

            conn.send({
                action: 'command/list',
                requestId: getRequestId()
            });
        });
    });

    describe('#command/get', function () {

        function runTest(client, done) {
            var requestId = getRequestId();

            client.on({
                action: 'command/get',
                status: 'success',
                requestId: requestId
            }, (err, result) => {
                assert.equal(result.command.id, commandId1, "Commands with required id is not returned");
                assert.equal(result.command.networkId, networkId, "Commands with networkId is not returned");
                done();
            });

            client.send({
                action: 'command/get',
                requestId: requestId,
                deviceId: deviceId,
                commandId: commandId1
            });
        }

        it('should check if inserted commands are in results', function (done) {
            runTest(conn, done);
        });

        it('should fail when using wrong jwt', function (done) {
            connInvalidToken.on({
                code: 403,
                error: 'Access is denied'
            }, done);

            connInvalidToken.send({
                action: 'command/get',
                requestId: getRequestId(),
                deviceId: deviceId,
                commandId: commandId1
            });
        });

        it('should fail when using wrong deviceId with client token', function (done) {
            var invalidDeviceId = 'invalid-device-id';

            conn.on({
                code: 403,
                error: 'Access is denied'
            }, done);

            conn.send({
                action: 'command/get',
                requestId: getRequestId(),
                deviceId: invalidDeviceId,
                commandId: commandId1
            });
        });

        it('should fail when using wrong deviceId with admin token', function (done) {
            var invalidDeviceId = 'invalid-device-id';
            adminConn.on({
                code: 404,
                error: `Device with such deviceId = ${invalidDeviceId} not found`
            }, done);

            adminConn.send({
                action: 'command/get',
                requestId: getRequestId(),
                deviceId: invalidDeviceId,
                commandId: commandId1
            });
        });

        it('should fail when no deviceId is provided', function (done) {
            conn.on({
                code: 400,
                error: 'Device id is wrong or empty'
            }, done);

            conn.send({
                action: 'command/get',
                requestId: getRequestId(),
                commandId: commandId1
            });
        });

        it('should fail when no notificationId is provided', function (done) {
            conn.on({
                code: 400,
                error: 'Command id is wrong or empty'
            }, done);

            conn.send({
                action: 'command/get',
                requestId: getRequestId(),
                deviceId: deviceId
            });
        });

        it('should fail when not integer commandId is provided', function (done) {
            var invalidCommandId = 'invalid-command-id';

            conn.on({
                code: 400,
                error: 'Command id is wrong or empty'
            }, done);

            conn.send({
                action: 'command/get',
                requestId: getRequestId(),
                deviceId: deviceId,
                notificationId: invalidCommandId
            });
        });

        it('should fail when not existing commandId is provided', function (done) {
            var invalidCommandId = 123454321;

            conn.on({
                code: 404,
                error: `Command with id = ${invalidCommandId} not found`
            }, done);

            conn.send({
                action: 'command/get',
                requestId: getRequestId(),
                deviceId: deviceId,
                commandId: invalidCommandId
            });
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

            client.on({
                action: 'command/subscribe',
                requestId: requestId,
                status: 'success'
            }, (err, result) => {
                assert.strictEqual(true, utils.core.hasNumericValue(result.subscriptionId), 'SubscriptionId must be the same');
                onSubscribed(err, result);
            });

            if (ts != null) {
                client.send({
                    action: 'command/subscribe',
                    requestId: requestId,
                    deviceId: deviceId,
                    names: [COMMAND],
                    timestamp: ts
                })
            } else {
                client.send({
                    action: 'command/subscribe',
                    requestId: requestId,
                    deviceId: deviceId,
                    names: [COMMAND]
                })
            }

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                subscriptionId = result.subscriptionId;
                client.on({
                    action: 'command/insert',
                    command: { command: COMMAND },
                    subscriptionId: subscriptionId
                }, cleanUp);

                req.create(path.COMMAND.get(deviceId))
                    .params({
                        jwt: token,
                        data: { command: COMMAND }
                    })
                    .send();

                function cleanUp(err) {

                    client.on({
                        action: 'command/unsubscribe',
                        status: 'success'
                    }, () => done(err));

                    client.send({
                        action: 'command/unsubscribe',
                        requestId: getRequestId(),
                        subscriptionId: subscriptionId
                    });

                }
            }
        }

        function runTestWithUpdatedCommands(client, ts, done) {
            var requestId = getRequestId();
            var subscriptionId = null;

            client.on({
                action: 'command/subscribe',
                requestId: requestId,
                status: 'success'
            }, (err, result) => {
                assert.strictEqual(true, utils.core.hasNumericValue(result.subscriptionId), 'SubscriptionId must be the same');
                onSubscribed(err, result);
            });

            if (ts != null) {
                client.send({
                    action: 'command/subscribe',
                    requestId: requestId,
                    deviceId: deviceId,
                    returnUpdatedCommands: true,
                    names: [COMMAND],
                    timestamp: ts
                });
            } else {
                client.send({
                    action: 'command/subscribe',
                    requestId: requestId,
                    deviceId: deviceId,
                    returnUpdatedCommands: true,
                    names: [COMMAND]
                });
            }

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                subscriptionId = result.subscriptionId;
                client.on({
                    action: 'command/update',
                    command: { command: COMMAND },
                    subscriptionId: subscriptionId
                }, cleanUp);

                req.create(path.COMMAND.get(deviceId))
                    .params({
                        jwt: token,
                        data: { command: COMMAND }
                    })
                    .send(function (err, result) {
                        if (err) {
                            return done(err);
                        }

                        req.update(path.combine(path.COMMAND.get(deviceId), result.id))
                            .params({
                                jwt: token,
                                data: { command: COMMAND }
                            }).send();
                    });

                function cleanUp(err) {

                    var requestId = getRequestId();

                    client.on({
                        action: 'command/unsubscribe',
                        requestId: requestId
                    }, () => done(err));

                    client.send({
                        action: 'command/unsubscribe',
                        requestId: requestId,
                        subscriptionId: subscriptionId
                    })
                }
            }
        }

        it('should subscribe to device commands, no returnUpdated, jwt authorization', function (done) {
            runTest(conn, null, done);
        });

        it('should subscribe to non existing device commands, no returnUpdated, client jwt authorization', function (done) {
            var requestId = getRequestId();
            conn.on({
                code: status.FORBIDDEN,
                error: 'Access is denied'
            }, done);
            conn.send({
                action: 'command/subscribe',
                requestId: requestId,
                deviceId: utils.NON_EXISTING_ID,
                names: [COMMAND]
            });
        });

        it('should subscribe to non existing device commands, no returnUpdated, admin jwt authorization', function (done) {
            var requestId = getRequestId();

            adminConn.on({
                code: status.NOT_FOUND,
                error: `Device with such deviceId = ${utils.NON_EXISTING_ID} not found`
            }, done);
            adminConn.send({
                action: 'command/subscribe',
                requestId: requestId,
                deviceId: utils.NON_EXISTING_ID,
                names: [COMMAND]
            }, done);
        });

        it('should subscribe to device commands with timestamp, no returnUpdated, jwt authorization', function (done) {
            runTest(conn, new Date().toISOString(), done);
        });

        it('should subscribe to device commands for single device, no returnUpdated,', function (done) {
            var requestId = getRequestId();

            conn.on({
                action: 'command/subscribe',
                requestId: requestId,
                status: 'success'
            }, onSubscribed)

            conn.send({
                action: 'command/subscribe',
                deviceId: deviceId,
                requestId: requestId
            })

            function onSubscribed(err) {
                if (err) {
                    return done(err);
                }

                conn.on({
                    action: 'command/insert',
                    command: { command: COMMAND }
                }, cleanUp);

                req.create(path.COMMAND.get(deviceId))
                    .params({
                        jwt: utils.jwt.admin,
                        data: { command: COMMAND }
                    })
                    .send();

                function cleanUp(err) {
                    var requestId = getRequestId();
                    conn.on({
                        action: 'command/unsubscribe',
                        requestId: requestId
                    }, () => done(err));
                    conn.send({
                        action: 'command/unsubscribe',
                        requestId: requestId
                    });
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

            conn.on({
                action: 'command/subscribe',
                requestId: requestId,
                status: 'success'
            }, onSubscribed);

            conn.send({
                action: 'command/subscribe',
                deviceId: deviceId,
                returnUpdatedCommands: true,
                requestId: requestId
            })

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                var subscriptionId = result.subscriptionId;
                conn.on({
                    action: 'command/update',
                    command: { command: COMMAND }
                }, cleanUp);

                req.create(path.COMMAND.get(deviceId))
                    .params({
                        jwt: utils.jwt.admin,
                        data: { command: COMMAND }
                    })
                    .send(function (err, result) {
                        if (err) {
                            return done(err);
                        }

                        req.update(path.combine(path.COMMAND.get(deviceId), result.id))
                            .params({
                                jwt: token,
                                data: { command: COMMAND }
                            }).send();
                    });

                function cleanUp(err) {
                    conn.on({
                        action: 'command/unsubscribe',
                        status: 'success'
                    }, () => done(err));

                    conn.send({
                        action: 'command/unsubscribe',
                        requestId: getRequestId(),
                        subscriptionId: subscriptionId
                    });
                }
            }
        });

        it('should subscribe to device commands for single network, returnUpdated = true', function (done) {
            var requestId = getRequestId();

            conn.on({
                action: 'command/subscribe',
                requestId: requestId,
                status: 'success'
            }, onSubscribed);

            conn.send({
                action: 'command/subscribe',
                networkIds: [networkId],
                returnUpdatedCommands: true,
                requestId: requestId
            });

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                var subscriptionId = result.subscriptionId;
                conn.on({
                    action: 'command/update',
                    command: { command: COMMAND }
                }, cleanUp);

                req.create(path.COMMAND.get(deviceId))
                    .params({
                        jwt: utils.jwt.admin,
                        data: { command: COMMAND }
                    })
                    .send(function (err, result) {
                        if (err) {
                            return done(err);
                        }

                        req.update(path.combine(path.COMMAND.get(deviceId), result.id))
                            .params({
                                jwt: token,
                                data: { command: COMMAND }
                            }).send();
                    });

                function cleanUp(err) {
                    conn.on({
                        action: 'command/unsubscribe',
                        status: 'success'
                    }, () => done(err));

                    conn.send({
                        action: 'command/unsubscribe',
                        requestId: getRequestId(),
                        subscriptionId: subscriptionId
                    });
                }
            }
        });

        it('should subscribe to device commands for multiple networks, returnUpdated = true', function (done) {
            var requestId = getRequestId();


            adminConn.on({
                action: 'command/subscribe',
                requestId: requestId,
                status: 'success'
            }, onSubscribed);

            adminConn.send({
                action: 'command/subscribe',
                networkIds: [networkId, networkId1],
                returnUpdatedCommands: true,
                requestId: requestId
            });

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                var subscriptionId = result.subscriptionId;
                adminConn.on({
                    action: 'command/update',
                    command: { command: COMMAND }
                }, cleanUp);

                req.create(path.COMMAND.get(deviceId))
                    .params({
                        jwt: utils.jwt.admin,
                        data: { command: COMMAND }
                    })
                    .send(function (err, result) {
                        if (err) {
                            return done(err);
                        }

                        req.update(path.combine(path.COMMAND.get(deviceId), result.id))
                            .params({
                                jwt: token,
                                data: { command: COMMAND }
                            }).send();
                    });

                function cleanUp(err) {
                    adminConn.on({
                        action: 'command/unsubscribe',
                        status: 'success'
                    }, () => done(err));
                    adminConn.send({
                        action: 'command/unsubscribe',
                        requestId: getRequestId(),
                        subscriptionId: subscriptionId
                    });
                }
            }
        });

        it('should subscribe to recently created device commands for multiple networks', function (done) {
            var requestId = getRequestId();
            var subscriptionId = null;

            adminConn.on({
                action: 'command/subscribe',
                requestId: requestId,
                status: 'success'
            }, deviceCreate);

            adminConn.send({
                action: 'command/subscribe',
                networkIds: [networkId, networkId1],
                requestId: requestId
            })


            function deviceCreate(err, result) {
                if (err) {
                    return done(err);
                }

                subscriptionId = result.subscriptionId;
                adminConn.on({
                    action: 'device/save',
                    requestId: requestId,
                    status: 'success'
                }, onSubscribed);

                adminConn.send({
                    action: 'device/save',
                    requestId: requestId,
                    deviceId: newDeviceId,
                    device: {
                        name: newDeviceId,
                        networkId: networkId
                    }
                })
            }

            function onSubscribed(err) {
                if (err) {
                    return done(err);
                }

                adminConn.on({
                    action: 'command/insert',
                    command: { command: COMMAND },
                    subscriptionId: subscriptionId
                }, cleanUp);

                req.create(path.COMMAND.get(newDeviceId))
                    .params({
                        jwt: utils.jwt.admin,
                        data: { command: COMMAND }
                    })
                    .send();


                function cleanUp(err) {
                    adminConn.send({
                        action: 'device/delete',
                        requestId: requestId,
                        deviceId: newDeviceId
                    })
                    adminConn.on({
                        action: 'device/delete',
                        requestId: requestId,
                        status: 'success'
                    }, () => {
                        adminConn.on({
                            action: 'command/unsubscribe',
                            status: 'success'
                        }, () => done(err));
                        adminConn.send({
                            action: 'command/unsubscribe',
                            requestId: getRequestId(),
                            subscriptionId: subscriptionId
                        });
                    });
                }
            }
        });

        it('should subscribe to recently created device commands for global subscription', function (done) {
            var requestId = getRequestId();
            var subscriptionId = null;

            conn.on({
                action: 'command/subscribe',
                requestId: requestId,
                status: 'success'
            }, deviceCreate);

            conn.send({
                action: 'command/subscribe',
                requestId: requestId
            });

            function deviceCreate(err, result) {
                if (err) {
                    return done(err);
                }
                subscriptionId = result.subscriptionId;

                conn.on({
                    action: 'device/save',
                    requestId: requestId,
                    status: 'success'
                }, onSubscribed);

                conn.send({
                    action: 'device/save',
                    requestId: requestId,
                    deviceId: newDeviceId,
                    device: {
                        name: newDeviceId,
                        networkId: networkId
                    }
                })
            }

            function onSubscribed(err) {
                if (err) {
                    return done(err);
                }


                conn.on({
                    action: 'command/insert',
                    command: { command: COMMAND },
                    subscriptionId: subscriptionId
                }, cleanUp);

                req.create(path.COMMAND.get(newDeviceId))
                    .params({
                        jwt: utils.jwt.admin,
                        data: { command: COMMAND }
                    })
                    .send();

                function cleanUp(err) {
                    conn.send({
                        action: 'device/delete',
                        requestId: requestId,
                        deviceId: newDeviceId
                    })
                    conn.on({
                        action: 'device/delete',
                        requestId: requestId,
                        status: 'success'
                    }, () => {
                        conn.on({
                            action: 'command/unsubscribe',
                            status: 'success'
                        }, () => done(err));
                        conn.send({
                            action: 'command/unsubscribe',
                            requestId: getRequestId(),
                            subscriptionId: subscriptionId
                        });
                    })
                }
            }
        });

        it('should subscribe to recently created device commands for global subscription, returnUpdated = true', function (done) {
            var requestId = getRequestId();
            var subscriptionId = null;

            conn.on({
                action: 'command/subscribe',
                requestId: requestId,
                status: 'success'
            }, deviceCreate);

            conn.send({
                action: 'command/subscribe',
                returnUpdatedCommands: true,
                requestId: requestId
            });

            function deviceCreate(err, result) {
                if (err) {
                    return done(err);
                }
                subscriptionId = result.subscriptionId;

                conn.on({
                    action: 'device/save',
                    requestId: requestId,
                    status: 'success'
                }, onSubscribed);

                conn.send({
                    action: 'device/save',
                    requestId: requestId,
                    deviceId: newDeviceId,
                    device: {
                        name: newDeviceId,
                        networkId: networkId
                    }
                });
            }

            function onSubscribed(err) {
                if (err) {
                    return done(err);
                }


                conn.on({
                    action: 'command/update',
                    command: { command: COMMAND },
                    subscriptionId: subscriptionId
                }, cleanUp);

                req.create(path.COMMAND.get(deviceId))
                    .params({
                        jwt: utils.jwt.admin,
                        data: { command: COMMAND }
                    })
                    .send(function (err, result) {
                        if (err) {
                            return done(err);
                        }

                        req.update(path.combine(path.COMMAND.get(deviceId), result.id))
                            .params({
                                jwt: token,
                                data: { command: COMMAND }
                            }).send();
                    });

                function cleanUp(err) {
                    var requestId = getRequestId();

                    conn.on({
                        action: 'device/delete',
                        requestId: requestId,
                        status: 'success'
                    }, () => {
                        var requestId = getRequestId();
                        conn.on({
                            action: 'command/unsubscribe',
                            requestId: requestId
                        }, () => done(err));
                        conn.send({
                            action: 'command/unsubscribe',
                            requestId: requestId,
                            subscriptionId: subscriptionId
                        });
                    });

                    conn.send({
                        action: 'device/delete',
                        requestId: requestId,
                        deviceId: newDeviceId
                    });

                }
            }
        });

        it('should not subscribe to recently created device in different network for network subscription', function (done) {
            var requestId = getRequestId();

            adminConn.on({
                action: 'command/subscribe',
                requestId: requestId,
                status: 'success'
            }, deviceCreate);

            adminConn.send({
                action: 'command/subscribe',
                networkIds: [networkId1],
                requestId: requestId
            });

            function deviceCreate(err) {
                if (err) {
                    return done(err);
                }
                adminConn.on({
                    action: 'device/save',
                    requestId: requestId,
                    status: 'success'
                }, onSubscribed);

                adminConn.send({
                    action: 'device/save',
                    requestId: requestId,
                    deviceId: newDeviceId,
                    device: {
                        name: newDeviceId,
                        networkId: networkId
                    }
                });
            }

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                var subscriptionId = result.subscriptionId;

                conn.on({
                    action: 'command/insert'
                }, (err, result) => {
                    assert.strictEqual(!(!err), true, 'Commands should not arrive');
                    cleanUp();
                });

                req.create(path.COMMAND.get(newDeviceId))
                    .params({
                        jwt: utils.jwt.admin,
                        data: { command: COMMAND }
                    })

                function cleanUp(err) {
                    conn.send({
                        action: 'device/delete',
                        requestId: requestId,
                        deviceId: newDeviceId
                    })
                    conn.on({
                        action: 'device/delete',
                        requestId: requestId,
                        status: 'success'
                    }, () => {
                        var requestId = getRequestId();

                        conn.on({
                            action: 'command/unsubscribe',
                            requestId: requestId
                        }, () => done(err));

                        conn.send({
                            action: 'command/unsubscribe',
                            requestId: requestId,
                            subscriptionId: subscriptionId
                        });
                    });
                }
            }
        });

        it('should reject subscribe to device commands for non existing network, returnUpdated = true', function (done) {
            var requestId = getRequestId();

            conn.on({
                error: 'Access is denied',
                code: 403
            }, done)
            conn.send({
                action: 'command/subscribe',
                networkIds: [utils.NON_EXISTING_ID],
                returnUpdatedCommands: true,
                requestId: requestId
            });
        });

        it('should reject subscribe to device commands for non existing network, returnUpdated = true for admin', function (done) {
            var requestId = getRequestId();

            adminConn.on({
                error: `Networks with such networkIds wasn't found: {[${utils.NON_EXISTING_ID}]}`,
                code: 404
            }, done);

            adminConn.send({
                action: 'command/subscribe',
                networkIds: [utils.NON_EXISTING_ID],
                returnUpdatedCommands: true,
                requestId: requestId
            })
        });

        it('should reject subscribe to device commands for non existing device type, returnUpdated = true for admin', function (done) {
            var requestId = getRequestId();

            adminConn.on({
                error: `Device types with such deviceTypeIds wasn't found: {[${utils.NON_EXISTING_ID}]}`,
                code: 404
            }, done);

            adminConn.send({
                action: 'command/subscribe',
                deviceTypeIds: [utils.NON_EXISTING_ID],
                returnUpdatedCommands: true,
                requestId: requestId
            });
        });

        it('should reject subscribe to device commands for empty device id, returnUpdated = true for admin', function (done) {
            var requestId = getRequestId();

            adminConn.on({
                error: 'Device id is wrong or empty',
                code: 400
            }, done);

            adminConn.send({
                action: 'command/subscribe',
                deviceId: '',
                returnUpdatedCommands: true,
                requestId: requestId
            });
        });
    });

    describe('#command/unsubscribe', function () {

        function runTest(client, done) {
            var subscriptionId = null;
            client.on({
                action: 'command/subscribe',
                status: 'success'
            }, onSubscribed);
            client.send({
                action: 'command/subscribe',
                requestId: getRequestId(),
                deviceId: deviceId,
                names: [COMMAND]
            })

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                var requestId = getRequestId();
                subscriptionId = result.subscriptionId;
                client.on({
                    action: 'command/unsubscribe',
                    requestId: requestId,
                    status: 'success'
                }, onUnubscribed);
                client.send({
                    action: 'command/unsubscribe',
                    requestId: requestId,
                    subscriptionId: subscriptionId
                });
            }

            function onUnubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                client.on({
                    action: 'command/insert'
                }, err => {
                    assert.strictEqual(!(!err), true, 'Commands should not arrive');
                    done();
                });

                req.create(path.COMMAND.get(deviceId))
                    .params({
                        jwt: utils.jwt.admin,
                        data: { command: COMMAND }
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
                result: { done: 'yes' }
            };

            var expectedUpdate = {
                command: COMMAND,
                lifetime: 500,
                status: 'Updated',
                result: { done: 'yes' }
            };

            client.on({
                action: 'command/insert',
                status: 'success'
            }, onCommandCreated);

            client.send({
                action: 'command/insert',
                requestId: getRequestId(),
                deviceId: deviceId,
                command: {
                    command: COMMAND,
                    lifetime: 500,
                    status: 'Inserted'
                }
            });

            function onCommandCreated(err, result) {
                if (err) {
                    return done(err);
                }

                var requestId = getRequestId();
                commandId = result.command.id;
                client.on({
                    action: 'command/update',
                    status: 'success',
                    requestId: requestId
                }, onCommandUpdated);
                client.send({
                    action: 'command/update',
                    requestId: requestId,
                    deviceId: deviceId,
                    commandId: commandId,
                    command: update
                });
            }

            function onCommandUpdated(err) {
                if (err) {
                    return done(err);
                }

                req.get(path.COMMAND.get(deviceId))
                    .params({ jwt: utils.jwt.admin, id: commandId })
                    .expect({ id: commandId })
                    .expect(expectedUpdate)
                    .send(done);
            }
        }

        it('should update existing command, jwt auth', function (done) {
            runTest(conn, done);
        });

        it('should fail when no deviceId is provided', function (done) {
            conn.on({
                error: 'Device id is wrong or empty',
                code: 400
            }, done);
            conn.send({
                action: 'command/update',
                requestId: getRequestId(),
                deviceId: null,
                commandId: commandId1,
                command: { command: COMMAND }
            });
        });

        it('should fail when using wrong deviceId', function (done) {
            var invalidDeviceId = 'invalid-device-id';

            conn.on({
                error: 'Access is denied',
                code: 403
            }, done);
            conn.send({
                action: 'command/update',
                requestId: getRequestId(),
                deviceId: invalidDeviceId,
                commandId: commandId1,
                command: { command: COMMAND }
            });
        });

    });

    describe('#srv: command/insert', function () {

        function runTest(client, done) {

            var subscriptionId = null;
            var command = {
                command: COMMAND,
                parameters: { a: '1', b: '2' },
                lifetime: 100500,
                status: 'Inserted',
                result: { done: 'yes' }
            };

            client.on({
                action: 'command/subscribe',
                status: 'success'
            }, onSubscribed);
            client.send({
                action: 'command/subscribe',
                requestId: getRequestId(),
                deviceIds: [deviceId],
                names: [COMMAND]
            });

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                subscriptionId = result.subscriptionId;
                client.on({
                    action: 'command/insert',
                    command: command,
                    subscriptionId: subscriptionId
                }, cleanUp);

                req.create(path.COMMAND.get(deviceId))
                    .params({
                        jwt: token,
                        data: command
                    })
                    .send();

                function cleanUp(err) {
                    client.on({
                        action: 'command/unsubscribe',
                        status: 'success'
                    }, () => done(err));
                    client.send({
                        action: 'command/unsubscribe',
                        requestId: getRequestId(),
                        subscriptionId: subscriptionId
                    });
                }
            }
        }

        it('should notify when command was inserted, jwt auth', function (done) {
            runTest(conn, done);
        });

        function runTestNoSubscr(client, done) {

            var command = {
                command: COMMAND,
                parameters: { a: '3', b: '4' },
                lifetime: 500100,
                status: 'Inserted',
                result: { done: 'yes' }
            };

            client.on({
                action: 'command/insert'
            }, function (err) {
                assert.strictEqual(!(!err), true, 'Commands should not arrive');
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
                parameters: { a: '1', b: '2' },
                status: 'Updated',
                result: { done: 'yes' }
            };

            client.on({
                action: 'command/insert',
                status: 'success'
            }, onCommandCreated);

            client.send({
                action: 'command/insert',
                requestId: getRequestId(),
                deviceId: deviceId,
                command: {
                    command: COMMAND,
                    lifetime: 500,
                    status: 'Inserted'
                }
            });


            function onCommandCreated(err, result) {
                if (err) {
                    return done(err);
                }

                var requestId = getRequestId();
                commandId = result.command.id;
                client.on({
                    action: 'command/update',
                    status: 'success'
                }, done);
                client.send({
                    action: 'command/update',
                    requestId: requestId,
                    deviceId: deviceId,
                    commandId: commandId,
                    command: update
                })
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
