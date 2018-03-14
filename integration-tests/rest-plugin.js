var assert = require('assert');
var async = require('async');
var format = require('util').format;
var req = require('./common/request');
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;
var Websocket = require('./common/ws');

var getRequestId = utils.core.getRequestId;

describe('REST API Plugin', function () {
    this.timeout(90000);

    var helper = utils.command;

    var NETWORK = utils.getName('network');
    var DEVICE = utils.getName('device');
    var PLUGIN = utils.getName('plugin');
    var PLUGIN1 = utils.getName('plugin');
    var PLUGIN2 = utils.getName('plugin');
    var PLUGIN3 = utils.getName('plugin');
    var DEVICE_ID = utils.getName('device-id');
    var COMMAND = utils.getName('cmd');
    var ACTIVE_STATUS = 'ACTIVE';
    var INACTIVE_STATUS = 'INACTIVE';
    var PLUGIN_COUNT_PATH = path.combine(path.PLUGIN, path.COUNT);

    var user = null;
    var user2 = null;
    var jwtWithoutPermissions = null;
    var jwtWithPermissions = null;
    var jwtWithPermissions2 = null;
    var commandId = null;
    var networkId = null;

    var pluginTopicName = null;

    var description = 'Plugin Description';
    var paramObject = JSON.stringify({ "asd": "asd" });

    before(function (done) {
        if (!utils.pluginUrl) {
            this.skip();
        }

        path.current = path.PLUGIN;

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
            var params = utils.device.getParamsObj(DEVICE, utils.jwt.admin,
                networkId, { name: DEVICE, version: '1' });
            params.id = DEVICE_ID;
            utils.update(path.DEVICE, params, function (err) {
                callback(err);
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

        function createUser2(callback) {
            utils.createUser2(1, networkId, function (err, result) {
                if (err) {
                    return callback(err);
                }

                user2 = result.user;
                callback();
            });
        }

        function createJWTWithoutPermissions(callback) {
            utils.jwt.create(user.id, ['CreateDeviceCommand', 'GetDeviceCommand', 'UpdateDeviceCommand'], [networkId], null, function (err, result) {
                if (err) {
                    return callback(err);
                }
                jwtWithoutPermissions = result.accessToken;
                callback()
            })
        }

        function createJWTWithPermissions(callback) {
            utils.jwt.create(user.id, ['*'], [networkId], null, function (err, result) {
                if (err) {
                    return callback(err);
                }
                jwtWithPermissions = result.accessToken;
                callback()
            })
        }

        function createJWTWithPermissions2(callback) {
            utils.jwt.create(user2.id, ['*'], [networkId], null, function (err, result) {
                if (err) {
                    return callback(err);
                }
                jwtWithPermissions2 = result.accessToken;
                callback()
            })
        }

        function createCommand(callback) {
            var params = helper.getParamsObj(COMMAND, utils.jwt.admin);
            utils.create(path.COMMAND.get(DEVICE_ID), params, function (err, result) {
                if (err) {
                    return callback(err);
                }

                commandId = result.id;

                callback();
            });
        }

        async.series([
            createNetwork,
            createDevice,
            createUser,
            createUser2,
            createJWTWithoutPermissions,
            createJWTWithPermissions,
            createJWTWithPermissions2,
            createCommand
        ], done);
    });

    describe('#Plugin Register', function () {
        before(function () {
            if (!utils.pluginUrl) {
                this.skip();
            }
        });

        it('should not register plugin without ManagePlugin permission', function (done) {
            var params = {
                jwt: jwtWithoutPermissions,
                data: { name: PLUGIN }
            };
            params.query = path.query('deviceIds', DEVICE_ID, 'pollType', 'Command');

            utils.createPlugin(path.current, params, function (err, result) {
                assert.strictEqual(err.error, 'Access is denied');
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);

                done();
            })
        });

        it('should not register plugin without any subsriptions', function (done) {
            var params = {
                jwt: utils.jwt.admin,
                data: {
                    name: utils.getName('plugin'),
                    description: description,
                    parameters: {
                        jsonString: paramObject
                    }
                }
            };
            params.query = path.query(
                'returnCommands', false,
                'returnUpdatedCommands', false,
                'returnNotifications', false
            );

            utils.createPlugin(path.current, params, function (err, result) {
                assert(err, 'Error message should be provided');
                assert.equal(err.httpStatus, 400, 'Error code should be 400');

                done();
            })
        });

        it('should register plugin with only notification subsription', function (done) {
            var params = {
                jwt: utils.jwt.admin,
                data: {
                    name: utils.getName('plugin'),
                    description: description,
                    parameters: {
                        jsonString: paramObject
                    }
                }
            };
            params.query = path.query(
                'returnCommands', false,
                'returnUpdatedCommands', false,
                'returnNotifications', true
            );

            utils.createPlugin(path.current, params, function (err, result) {
                assert(!err, 'No error');

                assert.equal(result.proxyEndpoint != null, true, 'Proxy endpoint is required');
                assert.equal(result.accessToken != null, true, 'Access token is not returned');
                assert.equal(result.refreshToken != null, true, 'Refresh token is not returned');
                assert.equal(result.topicName != null, true, 'Topic name is not returned');

                var params = {
                    jwt: utils.jwt.admin
                }
                var topicName = result.topicName;

                params.query = path.query(
                    'topicName', topicName
                )

                utils.getPlugin(path.PLUGIN, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');

                    assert.equal(topicName, result[0].topicName, 'Topic name is wrong');
                    var filter = result[0].filter.split('/')[0];
                    assert.equal(filter, 'notification', 'Filter is not equal to notification');
                    done();
                });
            })
        });

        it('should register plugin with admin token and all subscriptions', function (done) {

            var params = {
                jwt: utils.jwt.admin,
                data: {
                    name: PLUGIN,
                    description: description,
                    parameters: {
                        jsonString: paramObject
                    }
                }
            };
            params.query = path.query(
                'deviceId', DEVICE_ID,
                'networkIds', networkId,
                'names', '',
                'returnCommands', true,
                'returnUpdatedCommands', true,
                'returnNotifications', true
            );


            utils.createPlugin(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');

                assert.equal(result.proxyEndpoint != null, true, 'Proxy endpoint is required');
                assert.equal(result.accessToken != null, true, 'Access token is not returned');
                assert.equal(result.refreshToken != null, true, 'Refresh token is not returned');
                assert.equal(result.topicName != null, true, 'Topic name is not returned');

                var params = {
                    jwt: utils.jwt.admin
                }
                var topicName = result.topicName;

                params.query = path.query(
                    'topicName', topicName
                )

                utils.getPlugin(path.PLUGIN, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    assert.equal(topicName, result[0].topicName, 'Topic name is wrong');
                    var filter = result[0].filter.split('/')[0];
                    assert(filter.indexOf('command') !== -1, 'Filter doesn\'t contain command');
                    assert(filter.indexOf('command_update') !== -1, 'Filter doesn\'t contain command_update');
                    assert(filter.indexOf('notification') !== -1, 'Filter doesn\'t contain notification');
                    done();
                });
            })
        });

    });

    describe('#Plugin Update', function () {

        var NETWORK_1 = utils.getName('network');
        var networkId_1;
        var DEVICE_ID_1 = utils.getName('device-id');
        var DEVICE_1 = utils.getName('device');
        var NOTIFICATION = utils.getName('ws-notification');
        var PLUGIN1 = utils.getName('plugin');
        var pluginTopicName;

        before(function (done) {
            if (!utils.pluginUrl) {
                this.skip();
            }


            function createPlugin(callback) {

                var params = {
                    jwt: jwtWithPermissions,
                    data: {
                        name: PLUGIN1,
                        description: description,
                        parameters: {
                            jsonString: paramObject
                        }
                    }
                };

                params.query = path.query(
                    'deviceId', DEVICE_ID,
                    'networkIds', networkId,
                    'returnCommands', true,
                    'returnUpdatedCommands', true,
                    'returnNotifications', true
                );

                utils.createPlugin(path.current, params, function (err, result) {
                    pluginTopicName = result.topicName;

                    callback();
                })
            }

            function createDevice(callback) {
                var params = utils.device.getParamsObj(DEVICE_1, jwtWithPermissions,
                    networkId, { name: DEVICE_1, version: '1' });
                params.id = DEVICE_ID_1;
                utils.update(path.DEVICE, params, function (err) {
                    callback(err);
                });
            }

            function createNetwork(callback) {
                var params = {
                    jwt: utils.jwt.admin,
                    data: {
                        name: NETWORK_1
                    }
                };

                utils.create(path.NETWORK, params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    networkId_1 = result.id;
                    callback()
                });
            }

            async.series([
                createPlugin,
                createDevice,
                createNetwork
            ], done);
        });

        after(function (done) {
            if (!utils.pluginUrl) {
                this.skip();
            }
            var params = {
                jwt: jwtWithPermissions
            };

            params.query = path.query(
                'topicName', pluginTopicName
            );

            utils.deletePlugin(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                done();
            })
        });
        it('should fail with 403 on update plugin for token without permission', function (done) {
            var params = {
                jwt: jwtWithoutPermissions
            };

            params.query = path.query(
                'topicName', pluginTopicName,
                'status', ACTIVE_STATUS
            );

            utils.updatePlugin(path.current, params, function (err, result) {
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);

                done();
            })
        });

        it('should fail with 403 on updating other users\' plugins', function (done) {
            var params = {
                jwt: jwtWithPermissions2
            };

            params.query = path.query(
                'topicName', pluginTopicName,
                'status', ACTIVE_STATUS
            );

            utils.updatePlugin(path.current, params, function (err, result) {
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);

                done();
            })
        });

        it('should update plugin status to ACTIVE', function (done) {
            var params = {
                jwt: jwtWithPermissions
            };

            params.query = path.query(
                'topicName', pluginTopicName,
                'status', ACTIVE_STATUS
            );

            utils.updatePlugin(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');

                params.query = path.query(
                    'topicName', pluginTopicName
                );

                utils.getPlugin(path.current, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    assert.strictEqual(utils.core.isArrayOfLength(result, 1), true, 'Is array of 1 object');

                    utils.matches(result[0], {
                        status: ACTIVE_STATUS
                    });

                    done();
                });
            })
        });

        it('should fail on updating ACTIVE plugin filter', function (done) {
            var params = {
                jwt: jwtWithPermissions
            };

            params.query = path.query(
                'topicName', pluginTopicName,
                'returnCommands', false,
                'returnUpdatedCommands', true,
                'returnNotifications', false
            );

            utils.updatePlugin(path.current, params, function (err, result) {
                assert.strictEqual(err.error, 'Plugin\'s subscription filter can\'t be updated if plugin is ACTIVE');

                done();
            })
        });

        it('should fail on updating networkIds of ACTIVE plugin', function (done) {
            var params = {
                jwt: jwtWithPermissions
            };

            params.query = path.query(
                'topicName', pluginTopicName,
                'networkIds', networkId_1
            );

            utils.updatePlugin(path.current, params, function (err, result) {
                assert.strictEqual(err.error, 'Plugin\'s subscription filter can\'t be updated if plugin is ACTIVE');
                done();
            });
        });

        it('should fail on updating deviceId of ACTIVE plugin', function (done) {
            var params = {
                jwt: jwtWithPermissions
            };

            params.query = path.query(
                'topicName', pluginTopicName,
                'deviceId', DEVICE_ID_1
            );

            utils.updatePlugin(path.current, params, function (err, result) {
                assert.strictEqual(err.error, 'Plugin\'s subscription filter can\'t be updated if plugin is ACTIVE');

                done();
            })
        });

        it('should fail on updating notification names of ACTIVE plugin', function (done) {
            var params = {
                jwt: jwtWithPermissions
            };

            params.query = path.query(
                'topicName', pluginTopicName,
                'names', NOTIFICATION
            );

            utils.updatePlugin(path.current, params, function (err, result) {
                assert.strictEqual(err.error, 'Plugin\'s subscription filter can\'t be updated if plugin is ACTIVE');

                done();
            })
        });

        it('should update plugin status to INACTIVE', function (done) {
            var params = {
                jwt: jwtWithPermissions
            };

            params.query = path.query(
                'topicName', pluginTopicName,
                'status', INACTIVE_STATUS
            );

            utils.updatePlugin(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');

                params.query = path.query(
                    'topicName', pluginTopicName
                );

                utils.getPlugin(path.current, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    assert.strictEqual(utils.core.isArrayOfLength(result, 1), true, 'Is array of 1 object');

                    utils.matches(result[0], {
                        status: INACTIVE_STATUS
                    });

                    done();
                });
            })
        });

        it('should update filter of INACTIVE plugin', function (done) {
            var params = {
                jwt: jwtWithPermissions
            };

            params.query = path.query(
                'topicName', pluginTopicName,
                'returnCommands', false,
                'returnUpdatedCommands', true,
                'returnNotifications', false
            );

            utils.updatePlugin(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                done();
            })
        });

        it('should update networkIds of INACTIVE plugin', function (done) {
            var params = {
                jwt: jwtWithPermissions
            };

            params.query = path.query(
                'topicName', pluginTopicName,
                'networkIds', networkId_1
            );

            utils.updatePlugin(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                done();
            });
        });

        it('should update deviceId of INACTIVE plugin', function (done) {
            var params = {
                jwt: jwtWithPermissions
            };

            params.query = path.query(
                'topicName', pluginTopicName,
                'deviceId', DEVICE_ID_1
            );

            utils.updatePlugin(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                done();
            })
        });

        it('should update notification names of INACTIVE plugin', function (done) {
            var params = {
                jwt: jwtWithPermissions
            };

            params.query = path.query(
                'topicName', pluginTopicName,
                'names', NOTIFICATION
            );

            utils.updatePlugin(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                done();
            })
        });



    });

    describe('#Plugin Subscription actions', function () {

        function createNotification(notification, deviceId, callback) {
            req.create(path.NOTIFICATION.get(deviceId))
                .params({
                    jwt: utils.jwt.admin,
                    data: { notification: notification }
                })
                .send(callback);
        }

        function createCommand(command, deviceId, callback) {
            req.create(path.COMMAND.get(deviceId))
                .params({
                    jwt: utils.jwt.admin,
                    data: { command: command }
                })
                .send(callback);
        }

        function updateCommand(commandUpdate, commandId, deviceId, callback) {
            req.update(path.combine(path.COMMAND.get(deviceId), commandId))
                .params({
                    jwt: utils.jwt.admin,
                    data: { command: commandUpdate }
                }).send(callback);
        }

        function subscribe(client, topic, callback) {
            var msg = {
                t: 'topic',
                a: 'subscribe',
                p: {
                    sg: "",
                    t: [topic]
                }
            }
            client.send(msg);
            client.on({
                s: 0
            }, callback);
        }

        function unsubscribe(client, topic, callback) {

            var msg = {
                a: 'unsubscribe',
                t: 'topic',
                p: {
                    t: [topic]
                }
            }

            client.send(msg);
            client.on({
                s: 0
            }, callback);
        }

        function runTest(client, topic, deviceId, notification, done) {
            subscribe(client, topic, onSubscribed);

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }
                client.on({
                    t: 'notif',
                    s: 0
                }, cleanUp);

                createNotification(notification, deviceId);

                function cleanUp(err) {

                    if (err) {
                        done(err);
                    }
                    unsubscribe(client, topic, done);
                }
            }
        }

        function runTestCommand(client, topic, deviceId, command, done) {
            subscribe(client, topic, onSubscribed);

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                client.on({
                    t: 'notif',
                    s: 0
                }, checkResponse);

                createCommand(command, deviceId);

                function checkResponse(err, data) {
                    if (err) {
                        done(err);
                    }
                    var message = JSON.parse(data.p.m);
                    assert.strictEqual(message.b.command.command, command, 'Commands must be the same');
                    cleanUp();
                }

                function cleanUp(err) {
                    if (err) {
                        done(err);
                    }
                    unsubscribe(client, topic, done);
                }
            }
        }

        function runTestCommandUpdate(client, topic, deviceId, command, commandId, done) {
            subscribe(client, topic, onSubscribed);


            function onSubscribed(err, result) {

                client.on({
                    t: 'notif',
                    s: 0
                }, checkResponse);
                updateCommand(command, commandId, deviceId);

                function checkResponse(err, data) {
                    if (err) {
                        done(err);
                    }
                    var message = JSON.parse(data.p.m);
                    assert.strictEqual(message.b.command.command, command, 'Commands must be the same');
                    assert.strictEqual(message.b.command.id, commandId, 'Commands\' ids must be the same');
                    assert(message.b.command.isUpdated, 'Command wasn\'t updated');

                    cleanUp();
                }

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    unsubscribe(client, topic, done);
                }
            }
        }

        function runFailTest(client, topic, deviceId, notification, done) {
            subscribe(client, topic, onSubscribed);

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }
                client.on({
                    t: 'notif',
                    s: 0
                }, cleanUp);
                createNotification(notification, deviceId);

                function cleanUp(err) {
                    assert(err, 'Timeout error should be fired');
                    unsubscribe(client, topic, done);
                }
            }
        }

        function runFailTestCommand(client, topic, deviceId, command, done) {
            subscribe(client, topic, onSubscribed);

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }
                client.on({
                    t: 'notif',
                    s: 0
                }, cleanUp);

                createCommand(command, deviceId);

                function cleanUp(err) {
                    assert(err, 'Timeout error should be fired');
                    unsubscribe(client, topic, done);
                }
            }
        }

        function runFailTestCommandUpdate(client, topic, deviceId, command, commandId, done) {
            subscribe(client, topic, onSubscribed);

            function onSubscribed(err, result) {

                client.on({
                    t: 'notif',
                    s: 0
                }, cleanUp);
                updateCommand(command, commandId, deviceId);

                function cleanUp(err) {
                    assert(err, 'Timeout error should be thrown');

                    unsubscribe(client, topic, done);
                }
            }
        }

        describe('##Plugin Subscription Notification, Command, CommandUpdate', function () {

            var DEVICE = utils.getName('device');
            var DEVICE_ID = utils.getName('device-id');

            var NOTIFICATION = utils.getName('ws-notification');
            var COMMAND = utils.getName('ws-command');

            var PLUGIN_NOTIFICATION = utils.getName('plugin');
            var PLUGIN_COMMAND = utils.getName('plugin');
            var PLUGIN_COMMAND_UPDATE = utils.getName('plugin');

            var pluginNotification = {}, pluginCommand = {}, pluginCommandUpdate = {};

            before(function (done) {
                if (!utils.pluginUrl) {
                    this.skip();
                }

                function createDevice(callback) {
                    var params = utils.device.getParamsObj(DEVICE, utils.jwt.admin,
                        networkId, { name: DEVICE, version: '1' });
                    params.id = DEVICE_ID;
                    utils.update(path.DEVICE, params, function (err) {
                        callback(err);
                    });
                }

                function createPlugin(plugin, returnCommands, returnUpdatedCommands, returnNotifications, callback) {
                    var params = {
                        jwt: utils.jwt.admin,
                        data: {
                            name: plugin,
                            description: description,
                            parameters: {
                                jsonString: paramObject
                            }
                        }
                    };

                    params.query = path.query(
                        'returnCommands', returnCommands,
                        'returnUpdatedCommands', returnUpdatedCommands,
                        'returnNotifications', returnNotifications
                    );

                    utils.createPlugin(path.current, params, function (err, result) {
                        callback(null, result);
                    });
                }

                function updatePlugin(pluginCreds, callback) {
                    var params = {
                        jwt: utils.jwt.admin
                    };

                    params.query = path.query(
                        'topicName', pluginCreds.topicName,
                        'status', ACTIVE_STATUS
                    );

                    utils.updatePlugin(path.current, params, function (err, result) {
                        assert.strictEqual(!(!err), false, 'No error');
                        params.query = path.query(
                            'topicName', pluginCreds.topicName
                        );
                        callback(null, pluginCreds);
                    });
                }

                function createConn(pluginCreds, callback) {
                    var conn = new Websocket(pluginCreds.proxyEndpoint);
                    conn.connect(function (err) {
                        assert.strictEqual(!(!err), false, 'No error');
                        conn.send({
                            t: 'plugin',
                            a: 'authenticate',
                            p: {
                                token: pluginCreds.accessToken
                            }
                        });
                        conn.on({ s: 0 }, function (err) {
                            assert.strictEqual(!(!err), false, 'No error');
                            callback(null, conn)
                        });
                    });
                }


                function setUpPlugin(plugin, returnCommands, returnUpdatedCommands, returnNotifications, callback) {
                    createPlugin(plugin, returnCommands, returnUpdatedCommands, returnNotifications, function (err, result) {
                        var pluginCreds = result;
                        updatePlugin(result, function (err, result) {
                            createConn(result, function (err, result) {
                                pluginCreds.conn = result;
                                callback(null, pluginCreds);
                            })
                        })
                    })
                }

                async.series([
                    createDevice,
                    setUpPlugin.bind(null, PLUGIN_NOTIFICATION, false, false, true),
                    setUpPlugin.bind(null, PLUGIN_COMMAND, true, false, false),
                    setUpPlugin.bind(null, PLUGIN_COMMAND_UPDATE, false, true, false)
                ], function (err, result) {
                    pluginNotification = {
                        topic: result[1].topicName,
                        conn: result[1].conn
                    }
                    pluginCommand = {
                        topic: result[2].topicName,
                        conn: result[2].conn
                    }
                    pluginCommandUpdate = {
                        topic: result[3].topicName,
                        conn: result[3].conn
                    }
                    done();
                });
            });

            it('Should fail on subscribing on another topic', function (done) {
                subscribe(pluginNotification.conn, pluginNotification.topic, onSubscribed);

                function onSubscribed(err, result) {
                    var msg = {
                        t: 'topic',
                        a: 'subscribe',
                        p: {
                            sg: "",
                            t: [pluginCommand.topic]
                        }
                    }
                    pluginNotification.conn.send(msg);
                    pluginNotification.conn.on({
                        s: 1
                    },function(){
                        unsubscribe(pluginNotification.conn, pluginNotification.topic, done);
                    });

                }
            });
            describe('###Testing plugin, which can receive only notifications', function () {
                var COMMAND_ID;
                before(function (done) {
                    if (!utils.pluginUrl) {
                        this.skip();
                    }
                    createCommand(COMMAND, DEVICE_ID, function (err, result) {
                        COMMAND_ID = result.id;
                        done();
                    });
                });
                it('should receive notification from device', function (done) {
                    runTest(pluginNotification.conn, pluginNotification.topic, DEVICE_ID, NOTIFICATION, done);
                });
                it('shouldn\'t receive command from device', function (done) {
                    runFailTestCommand(pluginNotification.conn, pluginNotification.topic, DEVICE_ID, COMMAND, done);
                });
                it('shouldn\'t receive command_update from device', function (done) {
                    runFailTestCommandUpdate(pluginNotification.conn, pluginNotification.topic, DEVICE_ID, COMMAND, COMMAND_ID, done);
                });
            });

            describe('###Testing plugin, which can receive only commands', function () {
                var COMMAND_ID;
                before(function (done) {
                    if (!utils.pluginUrl) {
                        this.skip();
                    }
                    createCommand(COMMAND, DEVICE_ID, function (err, result) {
                        COMMAND_ID = result.id;
                        done();
                    });
                });
                it('shouldn\'t receive notification from device', function (done) {
                    runFailTest(pluginCommand.conn, pluginCommand.topic, DEVICE_ID, NOTIFICATION, done);
                });
                it('should receive command from device', function (done) {
                    runTestCommand(pluginCommand.conn, pluginCommand.topic, DEVICE_ID, COMMAND, done);
                });
                it('shouldn\'t receive command_update from device', function (done) {
                    runFailTestCommandUpdate(pluginCommand.conn, pluginCommand.topic, DEVICE_ID, COMMAND, COMMAND_ID, done);
                });
            });

            describe('###Testing plugin, which can receive only command updates', function () {
                var COMMAND_ID;
                before(function (done) {
                    if (!utils.pluginUrl) {
                        this.skip();
                    }
                    createCommand(COMMAND, DEVICE_ID, function (err, result) {
                        COMMAND_ID = result.id;
                        done();
                    });
                });
                it('shouldn\'t receive notification from device', function (done) {
                    runFailTest(pluginCommandUpdate.conn, pluginCommandUpdate.topic, DEVICE_ID, NOTIFICATION, done);
                });
                it('shouldn\'t receive command from device', function (done) {
                    runFailTestCommand(pluginCommandUpdate.conn, pluginCommandUpdate.topic, DEVICE_ID, COMMAND, done);
                });
                it('should receive command_update from device', function (done) {
                    runTestCommandUpdate(pluginCommandUpdate.conn, pluginCommandUpdate.topic, DEVICE_ID, COMMAND, COMMAND_ID, done);
                });
            });
        });

        describe('##Plugin Subscription DeviceType', function () {
            var DEVICE = utils.getName('device');
            var DEVICE_ID = utils.getName('device-id');
            var DEVICE_TYPE_ID = 2;

            var DEVICE_1 = utils.getName('device');
            var DEVICE_ID_1 = utils.getName('device');
            var DEVICE_TYPE_ID_1 = 1;

            var NOTIFICATION = utils.getName('ws-notification');
            var PLUGIN = utils.getName('plugin');
            var COMMAND = utils.getName('ws-command');
            var COMMAND_ID;
            var COMMAND_ID_1;
            var pluginCreds;
            var testPlugin;
            var conn = null;

            before(function (done) {
                if (!utils.pluginUrl) {
                    this.skip();
                }

                function createDevice(callback) {
                    var params = utils.device.getParamsObj(DEVICE, utils.jwt.admin,
                        networkId, {
                            name: DEVICE,
                            version: '1'
                        });
                    params.id = DEVICE_ID;
                    //adding device_type
                    params.data.deviceTypeId = DEVICE_TYPE_ID;
                    utils.update(path.DEVICE, params, function (err) {
                        var params = { jwt: utils.jwt.admin };
                        params.query = path.query('name', DEVICE);
                        utils.get(path.DEVICE, params, function (err, result) {
                            callback(err);
                        })


                    });
                }

                function createDevice1(callback) {
                    var params = utils.device.getParamsObj(DEVICE_1, utils.jwt.admin,
                        networkId, {
                            name: DEVICE_1,
                            version: '1'
                        });
                    params.id = DEVICE_ID_1;
                    //adding device_type
                    params.data.deviceTypeId = DEVICE_TYPE_ID_1;
                    utils.update(path.DEVICE, params, function (err) {
                        var params = { jwt: utils.jwt.admin };
                        params.query = path.query('name', DEVICE_1);
                        utils.get(path.DEVICE, params, function (err, result) {
                            callback(err);
                        })


                    });
                }

                function createPlugin(callback) {

                    var params = {
                        jwt: utils.jwt.admin,
                        data: {
                            name: PLUGIN,
                            description: description,
                            parameters: {
                                jsonString: paramObject
                            }
                        }
                    };

                    params.query = path.query(
                        'deviceTypeIds', DEVICE_TYPE_ID,
                        'returnCommands', true,
                        'returnUpdatedCommands', true,
                        'returnNotifications', true
                    );

                    utils.createPlugin(path.current, params, function (err, result) {
                        pluginCreds = result;
                        utils.getPlugin(path.PLUGIN, params, function (err, result) {
                            testPlugin = result[0];
                            callback();
                        });

                    })
                }

                function updatePlugin(callback) {
                    var params = {
                        jwt: utils.jwt.admin
                    };

                    params.query = path.query(
                        'topicName', pluginCreds.topicName,
                        'status', ACTIVE_STATUS
                    );

                    utils.updatePlugin(path.current, params, function (err, result) {
                        assert.strictEqual(!(!err), false, 'No error');

                        params.query = path.query(
                            'topicName', pluginCreds.topicName
                        );

                        utils.getPlugin(path.current, params, function (err, result) {
                            testPlugin = result[0];
                            callback();
                        });
                    })
                }

                function createCommandForUpdate(callback) {
                    createCommand(COMMAND, DEVICE_ID, function (err, result) {
                        COMMAND_ID = result.id;
                        callback();
                    });
                }

                function createCommandForUpdate1(callback) {
                    createCommand(COMMAND, DEVICE_ID_1, function (err, result) {
                        COMMAND_ID_1 = result.id;
                        callback();
                    });
                }

                function getWsUrl(callback) {
                    url = pluginCreds.proxyEndpoint;
                    callback();
                }

                function createConn(callback) {
                    conn = new Websocket(url);
                    conn.connect(callback);
                }

                function authenticateConn(callback) {
                    conn.send({
                        t: 'plugin',
                        a: 'authenticate',
                        p: {
                            token: pluginCreds.accessToken
                        }
                    });
                    conn.on({ s: 0 }, callback);
                }

                async.series([
                    createDevice,
                    createDevice1,
                    createPlugin,
                    updatePlugin,
                    createCommandForUpdate,
                    createCommandForUpdate1,
                    getWsUrl,
                    createConn,
                    authenticateConn
                ], done);
            });

            it('should not receive notification from device with specified device_type and throw timeout error', function (done) {
                runFailTest(conn, pluginCreds.topicName, DEVICE_ID_1, NOTIFICATION, done);
            });

            it('should not receive command notification from device with specified device_type and throw timeout error', function (done) {
                runFailTestCommand(conn, pluginCreds.topicName, DEVICE_ID_1, COMMAND, done);
            });

            it('should not receive command update notification from device with specified device_type and throw timeout error', function (done) {
                runFailTestCommandUpdate(conn, pluginCreds.topicName, DEVICE_ID_1, COMMAND, COMMAND_ID_1, done);
            });

            it('should receive notification from device with specified device_type', function (done) {
                runTest(conn, pluginCreds.topicName, DEVICE_ID, NOTIFICATION, done);
            });

            it('should receive command notification with specified device_type', function (done) {
                runTestCommand(conn, pluginCreds.topicName, DEVICE_ID, COMMAND, done);
            });

            it('should receive command_update notification with specified device_type', function (done) {
                runTestCommandUpdate(conn, pluginCreds.topicName, DEVICE_ID, COMMAND, COMMAND_ID, done)
            });

        });

        describe('##Plugin Subscription Network', function () {
            var DEVICE = utils.getName('device');
            var DEVICE_ID = utils.getName('device-id');
            var NETWORK = utils.getName('network');
            var NETWORK_ID = null;

            var DEVICE_1 = utils.getName('device');
            var DEVICE_ID_1 = utils.getName('device');
            var NETWORK_1 = utils.getName('network');
            var NETWORK_ID_1 = null;

            var NOTIFICATION = utils.getName('ws-notification');
            var PLUGIN = utils.getName('plugin');
            var COMMAND = utils.getName('ws-command');
            var COMMAND_ID;
            var COMMAND_ID_1;
            var pluginCreds;
            var testPlugin;
            var conn = null;

            before(function (done) {
                if (!utils.pluginUrl) {
                    this.skip();
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

                        NETWORK_ID = result.id;
                        callback()
                    });
                }

                function createNetwork1(callback) {
                    var params = {
                        jwt: utils.jwt.admin,
                        data: {
                            name: NETWORK_1
                        }
                    };

                    utils.create(path.NETWORK, params, function (err, result) {
                        if (err) {
                            return callback(err);
                        }

                        NETWORK_ID_1 = result.id;
                        callback()
                    });
                }

                function createDevice(callback) {
                    var params = utils.device.getParamsObj(DEVICE, utils.jwt.admin,
                        NETWORK_ID, {
                            name: DEVICE,
                            version: '1'
                        });
                    params.id = DEVICE_ID;
                    utils.update(path.DEVICE, params, function (err) {
                        var params = { jwt: utils.jwt.admin };
                        params.query = path.query('name', DEVICE);
                        utils.get(path.DEVICE, params, function (err, result) {
                            callback(err);
                        })


                    });
                }

                function createDevice1(callback) {
                    var params = utils.device.getParamsObj(DEVICE_1, utils.jwt.admin,
                        NETWORK_ID_1, {
                            name: DEVICE_1,
                            version: '1'
                        });
                    params.id = DEVICE_ID_1;
                    //adding device_type
                    utils.update(path.DEVICE, params, function (err) {
                        var params = { jwt: utils.jwt.admin };
                        params.query = path.query('name', DEVICE_1);
                        utils.get(path.DEVICE, params, function (err, result) {
                            callback(err);
                        })


                    });
                }

                function createPlugin(callback) {

                    var params = {
                        jwt: utils.jwt.admin,
                        data: {
                            name: PLUGIN,
                            description: description,
                            parameters: {
                                jsonString: paramObject
                            }
                        }
                    };

                    params.query = path.query(
                        'networkIds', NETWORK_ID,
                        'returnCommands', true,
                        'returnUpdatedCommands', true,
                        'returnNotifications', true
                    );

                    utils.createPlugin(path.current, params, function (err, result) {
                        pluginCreds = result;
                        utils.getPlugin(path.PLUGIN, params, function (err, result) {
                            testPlugin = result[0];
                            callback();
                        });

                    })
                }

                function updatePlugin(callback) {
                    var params = {
                        jwt: utils.jwt.admin
                    };

                    params.query = path.query(
                        'topicName', pluginCreds.topicName,
                        'status', ACTIVE_STATUS
                    );

                    utils.updatePlugin(path.current, params, function (err, result) {
                        assert.strictEqual(!(!err), false, 'No error');

                        params.query = path.query(
                            'topicName', pluginCreds.topicName
                        );

                        utils.getPlugin(path.current, params, function (err, result) {
                            testPlugin = result[0];
                            callback();
                        });
                    })
                }

                function createCommandForUpdate(callback) {
                    createCommand(COMMAND, DEVICE_ID, function (err, result) {
                        COMMAND_ID = result.id;
                        callback();
                    });
                }

                function createCommandForUpdate1(callback) {
                    createCommand(COMMAND, DEVICE_ID_1, function (err, result) {
                        COMMAND_ID_1 = result.id;
                        callback();
                    });
                }

                function getWsUrl(callback) {
                    url = pluginCreds.proxyEndpoint;
                    callback();
                }

                function createConn(callback) {
                    conn = new Websocket(url);
                    conn.connect(callback);
                }

                function authenticateConn(callback) {
                    conn.send({
                        t: 'plugin',
                        a: 'authenticate',
                        p: {
                            token: pluginCreds.accessToken
                        }
                    });
                    conn.on({ s: 0 }, callback);
                }

                async.series([
                    createNetwork,
                    createNetwork1,
                    createDevice,
                    createDevice1,
                    createPlugin,
                    updatePlugin,
                    createCommandForUpdate,
                    createCommandForUpdate1,
                    getWsUrl,
                    createConn,
                    authenticateConn
                ], done);
            });

            it('should not receive notification from device with specified network_id and throw timeout error', function (done) {
                runFailTest(conn, pluginCreds.topicName, DEVICE_ID_1, NOTIFICATION, done);
            });

            it('should not receive command notification from device with specified network_id and throw timeout error', function (done) {
                runFailTestCommand(conn, pluginCreds.topicName, DEVICE_ID_1, COMMAND, done);
            });

            it('should not receive command update notification from device with specified network_id and throw timeout error', function (done) {
                runFailTestCommandUpdate(conn, pluginCreds.topicName, DEVICE_ID_1, COMMAND, COMMAND_ID_1, done);
            });

            it('should receive notification from device with specified network_id', function (done) {
                runTest(conn, pluginCreds.topicName, DEVICE_ID, NOTIFICATION, done);
            });

            it('should receive command notification with specified network_id', function (done) {
                runTestCommand(conn, pluginCreds.topicName, DEVICE_ID, COMMAND, done);
            });

            it('should receive command_update notification with specified network_id', function (done) {
                runTestCommandUpdate(conn, pluginCreds.topicName, DEVICE_ID, COMMAND, COMMAND_ID, done)
            });
        });

        describe('##Plugin Subscription Notification name', function () {
            var DEVICE = utils.getName('device');
            var DEVICE_ID = utils.getName('device-id');

            var PLUGIN = utils.getName('plugin');
            var NOTIFICATION = utils.getName('ws-notification');
            var NOTIFICATION_1 = utils.getName('ws-notification');
            var COMMAND = utils.getName('ws-command');
            var COMMAND_1 = utils.getName('ws-command');
            var COMMAND_ID;
            var COMMAND_ID_1;

            var pluginCreds;
            var testPlugin;
            var conn = null;

            before(function (done) {
                if (!utils.pluginUrl) {
                    this.skip();
                }

                function createDevice(callback) {
                    var params = utils.device.getParamsObj(DEVICE, utils.jwt.admin,
                        networkId, {
                            name: DEVICE,
                            version: '1'
                        });
                    params.id = DEVICE_ID;
                    utils.update(path.DEVICE, params, function (err) {
                        var params = { jwt: utils.jwt.admin };
                        params.query = path.query('name', DEVICE);
                        utils.get(path.DEVICE, params, function (err, result) {
                            callback(err);
                        });
                    });
                }

                function createPlugin(callback) {

                    var params = {
                        jwt: utils.jwt.admin,
                        data: {
                            name: PLUGIN,
                            description: description,
                            parameters: {
                                jsonString: paramObject
                            }
                        }
                    };

                    params.query = path.query(
                        'names', [NOTIFICATION, COMMAND].join(','),
                        'returnCommands', true,
                        'returnUpdatedCommands', true,
                        'returnNotifications', true
                    );

                    utils.createPlugin(path.current, params, function (err, result) {
                        pluginCreds = result;
                        utils.getPlugin(path.PLUGIN, params, function (err, result) {
                            testPlugin = result[0];
                            callback();
                        });

                    })
                }

                function updatePlugin(callback) {
                    var params = {
                        jwt: utils.jwt.admin
                    };

                    params.query = path.query(
                        'topicName', pluginCreds.topicName,
                        'status', ACTIVE_STATUS
                    );

                    utils.updatePlugin(path.current, params, function (err, result) {
                        assert.strictEqual(!(!err), false, 'No error');

                        params.query = path.query(
                            'topicName', pluginCreds.topicName
                        );

                        utils.getPlugin(path.current, params, function (err, result) {
                            testPlugin = result[0];
                            callback();
                        });
                    })
                }

                function createCommandForUpdate(callback) {
                    createCommand(COMMAND, DEVICE_ID, function (err, result) {
                        COMMAND_ID = result.id;
                        callback();
                    });
                }

                function createCommandForUpdate1(callback) {
                    createCommand(COMMAND_1, DEVICE_ID, function (err, result) {
                        COMMAND_ID_1 = result.id;
                        callback();
                    });
                }

                function getWsUrl(callback) {
                    url = pluginCreds.proxyEndpoint;
                    callback();
                }

                function createConn(callback) {
                    conn = new Websocket(url);
                    conn.connect(callback);
                }

                function authenticateConn(callback) {
                    conn.send({
                        t: 'plugin',
                        a: 'authenticate',
                        p: {
                            token: pluginCreds.accessToken
                        }
                    });
                    conn.on({ s: 0 }, callback);
                }

                async.series([
                    createDevice,
                    createPlugin,
                    updatePlugin,
                    createCommandForUpdate,
                    createCommandForUpdate1,
                    getWsUrl,
                    createConn,
                    authenticateConn
                ], done);
            });

            it('should not receive notification from device with specified notification name and throw timeout error', function (done) {
                runFailTest(conn, pluginCreds.topicName, DEVICE_ID, NOTIFICATION_1, done);
            });

            it('should not receive command notification from device with specified notification name and throw timeout error', function (done) {
                runFailTestCommand(conn, pluginCreds.topicName, DEVICE_ID, COMMAND_1, done);
            });

            it('should not receive command update notification from device with specified notification name and throw timeout error', function (done) {
                runFailTestCommandUpdate(conn, pluginCreds.topicName, DEVICE_ID, COMMAND_1, COMMAND_ID_1, done);
            });

            it('should receive notification from device with specified notification name', function (done) {
                runTest(conn, pluginCreds.topicName, DEVICE_ID, NOTIFICATION, done);
            });

            it('should receive command notification with specified command name', function (done) {
                runTestCommand(conn, pluginCreds.topicName, DEVICE_ID, COMMAND, done);
            });

            it('should receive command_update notification with specified command update name', function (done) {
                runTestCommandUpdate(conn, pluginCreds.topicName, DEVICE_ID, COMMAND, COMMAND_ID, done)
            });

        });
    });

    describe('#Plugin Subscription status', function () {
        before(function (done) {
            if (!utils.pluginUrl) {
                this.skip();
            }

            function createPlugin(callback) {

                var params = {
                    jwt: utils.jwt.admin,
                    data: {
                        name: PLUGIN3,
                        description: description,
                        parameters: {
                            jsonString: paramObject
                        }
                    }
                };

                params.query = path.query(
                    'deviceId', DEVICE_ID,
                    'networkIds', networkId,
                    'names', '',
                    'returnCommands', true,
                    'returnUpdatedCommands', true,
                    'returnNotifications', true
                );

                utils.createPlugin(path.current, params, function (err, result) {
                    pluginTopicName = result.topicName;

                    callback();
                })
            }

            async.series([
                createPlugin
            ], done);
        });

        it('registered plugin should not have a subscription', function (done) {

            var params = {
                jwt: utils.jwt.admin
            };

            params.query = path.query(
                'topicName', pluginTopicName
            );

            utils.getPlugin(path.current, params, function (err, getResult) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(getResult, 1), true, 'Is array of 1 object');
                utils.matches(getResult[0], {
                    name: PLUGIN3,
                    subscriptionId: null
                });

                done();
            });
        });

        it('activated plugin should have a subscription', function (done) {

            var params = {
                jwt: utils.jwt.admin
            };

            params.query = path.query(
                'topicName', pluginTopicName,
                'status', ACTIVE_STATUS
            );

            utils.updatePlugin(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');

                params.query = path.query(
                    'topicName', pluginTopicName
                );

                utils.getPlugin(path.current, params, function (err, getResult) {
                    assert.strictEqual(!(!err), false, 'No error');
                    assert.strictEqual(utils.core.isArrayOfLength(getResult, 1), true, 'Is array of 1 object');

                    var updatedPlugin = getResult[0];
                    assert.strictEqual(updatedPlugin.name === PLUGIN3, true);
                    assert.strictEqual(updatedPlugin.subscriptionId !== null, true);

                    done();
                });
            })
        });

        it('deactivated plugin should not have a subscription', function (done) {

            var params = {
                jwt: utils.jwt.admin
            };

            params.query = path.query(
                'topicName', pluginTopicName,
                'status', INACTIVE_STATUS
            );

            utils.updatePlugin(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');

                params.query = path.query(
                    'topicName', pluginTopicName
                );

                utils.getPlugin(path.current, params, function (err, getResult) {
                    assert.strictEqual(!(!err), false, 'No error');
                    assert.strictEqual(utils.core.isArrayOfLength(getResult, 1), true, 'Is array of 1 object');

                    utils.matches(getResult[0], {
                        name: PLUGIN3,
                        subscriptionId: null
                    });

                    done();
                });
            })
        });

    });

    describe('#Plugin Delete', function () {
        before(function (done) {
            if (!utils.pluginUrl) {
                this.skip();
            }

            function createPlugin(callback) {

                var params = {
                    jwt: jwtWithPermissions,
                    data: {
                        name: PLUGIN2,
                        description: description,
                        parameters: {
                            jsonString: paramObject
                        }
                    }
                };

                params.query = path.query(
                    'deviceId', DEVICE_ID,
                    'networkIds', networkId,
                    'returnCommands', true,
                    'returnUpdatedCommands', true,
                    'returnNotifications', true
                );

                utils.createPlugin(path.current, params, function (err, result) {
                    pluginTopicName = result.topicName;

                    callback();
                })
            }

            async.series([
                createPlugin
            ], done);
        });

        it('should fail with 403 on delete plugin for token without permission', function (done) {
            var params = {
                jwt: jwtWithoutPermissions
            };

            params.query = path.query(
                'topicName', pluginTopicName
            );

            utils.deletePlugin(path.current, params, function (err, result) {
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);

                done();
            })
        });

        it('should fail with 403 on deleting other users\' plugins', function (done) {
            var params = {
                jwt: jwtWithPermissions2
            };

            params.query = path.query(
                'topicName', pluginTopicName
            );

            utils.deletePlugin(path.current, params, function (err, result) {
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);

                done();
            })
        });

        it('should delete plugin', function (done) {
            var params = {
                jwt: jwtWithPermissions
            };

            params.query = path.query(
                'topicName', pluginTopicName
            );

            utils.deletePlugin(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');

                params.query = path.query(
                    'topicName', pluginTopicName
                );

                utils.getPlugin(path.current, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    assert.strictEqual(utils.core.isArrayOfLength(result, 0), true, 'Is array of 0 objects');

                    done();
                });
            })
        });
    });

    describe('#Plugin List', function () {
        var PLUGIN_USER = utils.getName('plugin');
        var PLUGIN1 = utils.getName('plugin');
        var PLUGIN2 = utils.getName('plugin');
        var PLUGIN3 = utils.getName('plugin');
        var DEVICE_ID = utils.getName('device');
        var SORT_FIELD_ID = 'Id';
        var SORT_FIELD_NAME = 'Name';
        var SORT_ORDER_ASC = 'ASC';
        var SORT_ORDER_DESC = 'DESC';

        var pluginCreds1, pluginCreds2, pluginCreds3;
        var TOPIC_NAME;
        before(function (done) {
            if (!utils.pluginUrl) {
                this.skip();
            }

            function createDevice(callback) {
                var params = utils.device.getParamsObj(DEVICE, utils.jwt.admin,
                    networkId, { name: DEVICE, version: '1' });
                params.id = DEVICE_ID;
                utils.update(path.DEVICE, params, function (err) {
                    callback(err);
                });
            }

            function createPlugin(plugin, returnCommands, returnUpdatedCommands, returnNotifications, jwt, callback) {
                var params = {
                    jwt: jwt,
                    data: {
                        name: plugin,
                        description: description,
                        parameters: {
                            jsonString: paramObject
                        }
                    }
                };

                params.query = path.query(
                    'deviceId', DEVICE_ID,
                    'networkIds', networkId,
                    'returnCommands', returnCommands,
                    'returnUpdatedCommands', returnUpdatedCommands,
                    'returnNotifications', returnNotifications
                );

                utils.createPlugin(path.current, params, function (err, result) {
                    callback(null, result, jwt);
                });
            }

            function updatePlugin(pluginCreds, jwt, callback) {
                var params = {
                    jwt: jwt
                };

                params.query = path.query(
                    'topicName', pluginCreds.topicName,
                    'status', ACTIVE_STATUS
                );

                utils.updatePlugin(path.current, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    params.query = path.query(
                        'topicName', pluginCreds.topicName
                    );
                    callback(null, pluginCreds);
                });
            }

            function setUpPlugin(plugin, returnCommands, returnUpdatedCommands, returnNotifications, jwt, callback) {
                createPlugin(plugin, returnCommands, returnUpdatedCommands, returnNotifications, jwt, function (err, result, jwt) {
                    var pluginCreds = result;
                    updatePlugin(result, jwt, function (err, result) {
                        callback(null, pluginCreds);
                    })
                })
            }


            async.series([
                createDevice,
                createPlugin.bind(null, PLUGIN_USER, true, true, true, jwtWithPermissions),
                setUpPlugin.bind(null, PLUGIN1, true, true, true, utils.jwt.admin),
                setUpPlugin.bind(null, PLUGIN2, true, true, true, utils.jwt.admin),
                setUpPlugin.bind(null, PLUGIN3, true, true, true, utils.jwt.admin)
            ], function (err, result) {
                assert(!err, 'Error shouldn\'t be fired');
                // get topic name to check filter
                TOPIC_NAME = result[2].topicName;
                done();
            });
        });

        it('should get plugins by name', function (done) {
            var params = {
                jwt: utils.jwt.admin
            };
            params.query = path.query(
                'name', PLUGIN1
            );
            utils.getPlugin(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(PLUGIN1, result[0].name, 'Names should be equal');
                done();
            })
        });

        it('should get plugin by topic name', function (done) {
            var params = {
                jwt: utils.jwt.admin
            };
            params.query = path.query(
                'topicName', TOPIC_NAME
            );
            utils.getPlugin(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(TOPIC_NAME, result[0].topicName, 'Topic names should be equal');
                done();
            })
        });

        it('should get plugins by status', function (done) {
            var params = {
                jwt: utils.jwt.admin
            };

            params.query = path.query(
                'status', 0 // int for active status
            );
            utils.getPlugin(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert(result.length > 0, 'Returned array shouldn\'t be empty');
                result.forEach(function (plugin) {
                    utils.matches(plugin, {
                        status: ACTIVE_STATUS
                    });
                });
                done();
            })
        });

        it('should get sorteed plugins by Id ASC', function (done) {
            var params = {
                jwt: utils.jwt.admin
            };

            params.query = path.query(
                'sortField', SORT_FIELD_ID,
                'sortOrder', SORT_ORDER_ASC
            );
            utils.getPlugin(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert(result.length > 0, 'Returned array shouldn\'t be empty');
                result.reduce(function (prevValue, curValue, i, arr) {
                    if (prevValue.id > curValue.id)
                        done('Returned array should be sorted by Id ASC');
                    return prevValue;
                });
                done();
            })
        });

        it('should get sorted plugins by Name DESC', function (done) {
            var params = {
                jwt: utils.jwt.admin
            };

            params.query = path.query(
                'sortField', SORT_FIELD_NAME,
                'sortOrder', SORT_ORDER_DESC
            );
            utils.getPlugin(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert(result.length > 0, 'Returned array shouldn\'t be empty');
                var sorted = null;
                var i = 0;
                while (i < result.length - 1 && !sorted) {
                    if (result[i].name < result[i + 1].name) {
                        sorted = 'Returned array of plugins should be sorted by Name DESC';
                    }
                    i++;
                }
                done(sorted);
            });
        });

        it('should get specified amount of plugins', function (done) {
            var params = {
                jwt: utils.jwt.admin
            };
            var TAKE_NUMBER = 2;

            params.query = path.query(
                'take', TAKE_NUMBER
            );
            utils.getPlugin(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert(result.length === TAKE_NUMBER, 'Returned array shouldn\'t be empty');
                done();
            });
        });

        it('should skip specified amount of plugins', function (done) {
            var params = {
                jwt: utils.jwt.admin
            };
            var SKIP_NUMBER = 2;


            utils.getPlugin(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                var pluginsAmount = result.length;
                params.query = path.query(
                    'skip', SKIP_NUMBER
                );
                utils.getPlugin(path.current, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    assert.strictEqual(pluginsAmount, result.length + SKIP_NUMBER, 'Plugins must be skipped with specified amount');
                });
                done();
            });
        });

        it('should get plugins with specified userId', function (done) {
            var params = {
                jwt: utils.jwt.admin
            };
            utils.getPlugin(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                var pluginsAmount = result.length;
                params.query = path.query(
                    'userId', user.id
                );
                utils.getPlugin(path.current, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    utils.matches(result[0], {
                        name: PLUGIN_USER
                    });
                });
                done();
            });
        });

        it('should count all user plugins', function (done) {
            utils.getPlugin(PLUGIN_COUNT_PATH, { jwt: jwtWithPermissions }, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(result.count, 1);

                done();
            })
        });

        it('should get all user plugins', function (done) {
            utils.getPlugin(path.current, { jwt: jwtWithPermissions }, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true, 'Is array of 1 object');
                utils.matches(result[0], {
                    name: PLUGIN_USER
                });

                done();
            })
        });

        it('should count all plugins with admin token', function (done) {
            utils.getPlugin(PLUGIN_COUNT_PATH, { jwt: utils.jwt.admin }, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(result.count > 0, true);

                done();
            })
        });

        it('should get all plugins with admin token', function (done) {
            utils.getPlugin(path.current, { jwt: utils.jwt.admin }, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(result.length > 0, true);
                done();
            })
        });

        it('should fail with 403 on count all plugins for token without permission', function (done) {
            utils.getPlugin(PLUGIN_COUNT_PATH, { jwt: jwtWithoutPermissions }, function (err, result) {
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);

                done();
            })
        });

        it('should fail with 403 on list all plugins for token without permission', function (done) {
            utils.getPlugin(path.current, { jwt: jwtWithoutPermissions }, function (err, result) {
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);

                done();
            })
        });

        it('should fail with 403 on user counting other users\' plugins', function (done) {
            var params = { jwt: jwtWithPermissions };
            params.query = path.query('userId', 1);
            utils.getPlugin(PLUGIN_COUNT_PATH, params, function (err, result) {
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);

                done();
            })
        });

        it('should fail with 403 on user requesting other users\' plugins', function (done) {
            var params = { jwt: jwtWithPermissions };
            params.query = path.query('userId', 1);
            utils.getPlugin(path.current, params, function (err, result) {
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);

                done();
            })
        });


    });

    after(function (done) {
        utils.clearDataJWT(done);
    });
});
