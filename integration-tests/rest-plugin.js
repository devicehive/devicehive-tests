var assert = require('assert');
var async = require('async');
var format = require('util').format;
var req = require('./common/request');
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;
var Websocket = require('./common/websocket');
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

            async.series([
                createPlugin
            ], done);
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

        it('should update plugin status', function (done) {
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

        it('should update plugin filter', function (done) {
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
    });

    describe.only('#Plugin Subscription Device', function () {

        var DEVICE = utils.getName('device');
        var DEVICE_ID = utils.getName('device-id');
        var NOTIFICATION = utils.getName('ws-notification');
        var COMMAND = utils.getName('ws-command');
        var PLUGIN = utils.getName('plugin');
        var pluginCreds;
        var testPlugin;
        var conn = null;

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

            function getWsUrl(callback) {
                url = pluginCreds.proxyEndpoint;
                callback();
            }

            function createConn(callback) {
                conn = new Websocket(url);
                conn.connect(callback);
            }

            function authenticateConn(callback) {
                conn.params({
                    t: 'plugin',
                    a: 'authenticate',
                    p: {
                        token: pluginCreds.accessToken
                    }
                })
                    .send(callback);
            }

            async.series([
                createDevice,
                createPlugin,
                updatePlugin,
                getWsUrl,
                createConn,
                authenticateConn
            ], done);
        });

        // block receving from all devices

        //add deep equality with commands through JSON.parse
        function runTest(client, done) {

            var requestId = getRequestId();
            var subscriptionId = null;
            client.params({
                t: 'topic',
                a: 'subscribe',
                p: {
                    sg: "",
                    t: [pluginCreds.topicName]
                }
            })
                .send(onSubscribed);

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                subscriptionId = result.subscriptionId;
                client.waitFor('notif', cleanUp, 't')
                    .expect({
                        t: 'notif',
                        s: 0
                    });

                req.create(path.NOTIFICATION.get(DEVICE_ID))
                    .params({
                        jwt: utils.jwt.admin,
                        data: { notification: NOTIFICATION }
                    })
                    .send();

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    client.params({
                        a: 'unsubscribe',
                        t: 'topic',
                        p: {
                            t: [pluginCreds.topicName]
                        }
                    })
                        .expect({
                            t: 'topic',
                            s: 0,
                            a: 'unsubscribe'
                        })
                        .send(done);
                }
            }
        }

        function runTestCommand(client, done) {
            var requestId = getRequestId();
            var subscriptionId = null;
            client.params({
                t: 'topic',
                a: 'subscribe',
                p: {
                    sg: "",
                    t: [pluginCreds.topicName]
                }
            })
                .send(onSubscribed);

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                subscriptionId = result.subscriptionId;
                client.waitFor('notif', cleanUp, 't')
                    .expect({
                        t: 'notif',
                        s: 0
                    });

                req.create(path.COMMAND.get(DEVICE_ID))
                    .params({
                        jwt: utils.jwt.admin,
                        data: { command: COMMAND }
                    })
                    .send();

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    client.params({
                        a: 'unsubscribe',
                        t: 'topic',
                        p: {
                            t: [pluginCreds.topicName]
                        }
                    })
                        .expect({
                            t: 'topic',
                            s: 0,
                            a: 'unsubscribe'
                        })
                        .send(done);
                }
            }
        }

        function runTestCommandUpdate(client, done) {
            var requestId = getRequestId();
            var subscriptionId = null;
            client.params({
                t: 'topic',
                a: 'subscribe',
                p: {
                    sg: "",
                    t: [pluginCreds.topicName]
                }
            })
                .send(onSubscribed);

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                subscriptionId = result.subscriptionId;
                client.waitFor('notif', waitCommandUpdate, 't')
                    .expect({
                        t: 'notif',
                        s: 0
                    });

                req.create(path.COMMAND.get(DEVICE_ID))
                    .params({
                        jwt: utils.jwt.admin,
                        data: { command: COMMAND }
                    })
                    .send(function (err, result) {
                        if (err) {
                            return done(err);
                        }

                        req.update(path.combine(path.COMMAND.get(DEVICE_ID), result.id))
                            .params({
                                jwt: utils.jwt.admin,
                                data: { command: COMMAND }
                            }).send();
                    });

                function waitCommandUpdate(err) {
                    if (err) {
                        return done(err);
                    }
                    client.waitFor('notif', checkAnswer, 't')
                        .expect({
                            t: 'notif',
                            s: 0,
                            p: {
                                m: {
                                }
                            }
                        });
                }
                function checkAnswer(err, data) {
                    if (err) {
                        done(err);
                    }
                    var message = JSON.parse(data.p.m);
                    assert(message.b.command.isUpdated, 'Command wasn\'t updated');

                    cleanUp();
                }

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    client.params({
                        a: 'unsubscribe',
                        t: 'topic',
                        p: {
                            t: [pluginCreds.topicName]
                        }
                    })
                        .expect({
                            t: 'topic',
                            s: 0,
                            a: 'unsubscribe'
                        })
                        .send(done);
                }
            }
        }

        it('should receive notification from device', function (done) {
            runTest(conn, done);
        });

        it('should receive command notification', function (done) {
            runTestCommand(conn, done);
        });

        it('should receive command_update notification', function (done) {
            runTestCommandUpdate(conn, done)
        });

    });

    describe.only('#Plugin Subscription DeviceType', function () {
        var DEVICE = utils.getName('device');
        var DEVICE_ID = utils.getName('device-id');
        var DEVICE_TYPE_ID = 2;

        var DEVICE_1 = utils.getName('device');
        var DEVICE_ID_1 = utils.getName('device');
        var DEVICE_TYPE_ID_1 = 1;

        var NOTIFICATION = utils.getName('ws-notification');
        var PLUGIN = utils.getName('plugin');
        var COMMAND = utils.getName('ws-command');
        var pluginCreds;
        var testPlugin;
        var conn = null;

        function createNotification(deviceId, callback) {
            req.create(path.NOTIFICATION.get(deviceId))
                .params({
                    jwt: utils.jwt.admin,
                    data: { notification: NOTIFICATION }
                })
                .send(callback);
        }

        function createCommand(deviceId, callback) {
            req.create(path.COMMAND.get(deviceId))
                .params({
                    jwt: utils.jwt.admin,
                    data: { command: COMMAND }
                })
                .send(callback);
        }

        function updateCommand(deviceId, commandId, callback) {
            req.update(path.combine(path.COMMAND.get(deviceId), commandId))
                .params({
                    jwt: utils.jwt.admin,
                    data: { command: COMMAND }
                }).send(callback);
        }



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

                        console.log(result);

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

                        console.log(result);

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

            function getWsUrl(callback) {
                url = pluginCreds.proxyEndpoint;
                callback();
            }

            function createConn(callback) {
                conn = new Websocket(url);
                conn.connect(callback);
            }

            function authenticateConn(callback) {
                conn.params({
                    t: 'plugin',
                    a: 'authenticate',
                    p: {
                        token: pluginCreds.accessToken
                    }
                })
                    .send(callback);
            }

            async.series([
                createDevice,
                createDevice1,
                createPlugin,
                updatePlugin,
                getWsUrl,
                createConn,
                authenticateConn
            ], done);
        });

        // block receving from all devices
        //edit checkAnswer
        //add possibility to change type (command/command_update/notification)???
        //add deep equality with commands through JSON.parse
        function runTest(client, done) {
            client.params({
                t: 'topic',
                a: 'subscribe',
                p: {
                    sg: "",
                    t: [pluginCreds.topicName]
                }
            })
                .send(onSubscribed);

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }
                client.waitFor('notif', cleanUp, 't')
                    .expect({
                        t: 'notif',
                        s: 0
                    });
                // creating notification with wrong device_type firstly
                createNotification(DEVICE_ID_1, function () {
                    createNotification(DEVICE_ID);
                });

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    client.params({
                        a: 'unsubscribe',
                        t: 'topic',
                        p: {
                            t: [pluginCreds.topicName]
                        }
                    })
                        .expect({
                            t: 'topic',
                            s: 0,
                            a: 'unsubscribe'
                        })
                        .send(done);
                }
            }
        }

        function runTestCommand(client, done) {
            var requestId = getRequestId();
            var subscriptionId = null;
            client.params({
                t: 'topic',
                a: 'subscribe',
                p: {
                    sg: "",
                    t: [pluginCreds.topicName]
                }
            })
                .send(onSubscribed);

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                subscriptionId = result.subscriptionId;
                client.waitFor('notif', cleanUp, 't')
                    .expect({
                        t: 'notif',
                        s: 0
                    });

                createCommand(DEVICE_ID_1, function () {
                    createCommand(DEVICE_ID);
                });

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    client.params({
                        a: 'unsubscribe',
                        t: 'topic',
                        p: {
                            t: [pluginCreds.topicName]
                        }
                    })
                        .expect({
                            t: 'topic',
                            s: 0,
                            a: 'unsubscribe'
                        })
                        .send(done);
                }
            }
        }


        function runTestCommandUpdate(client, done) {
            var requestId = getRequestId();
            var subscriptionId = null;
            client.params({
                t: 'topic',
                a: 'subscribe',
                p: {
                    sg: "",
                    t: [pluginCreds.topicName]
                }
            })
                .send(onSubscribed);

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                var commandId, commandId_1;

                subscriptionId = result.subscriptionId;
                client.waitFor('notif', waitCommandUpdate, 't')
                    .expect({
                        t: 'notif',
                        s: 0
                    });

                createCommand(DEVICE_ID_1, function (err, result) {
                    commandId_1 = result.id;
                    createCommand(DEVICE_ID, waitCommandUpdate);
                });

                function waitCommandUpdate(err, result) {
                    if (err) {
                        return done(err);
                    }
                    commandId = result.id;
                    client.waitFor('notif', checkAnswer, 't')
                        .expect({
                            t: 'notif',
                            s: 0
                        });
                    updateCommand(DEVICE_ID_1, commandId_1, function () {
                        updateCommand(DEVICE_ID, commandId);
                    });
                }
                function checkAnswer(err, data) {
                    if (err) {
                        done(err);
                    }
                    var message = JSON.parse(data.p.m);
                    assert(message.b.command.isUpdated, 'Command wasn\'t updated');

                    cleanUp();
                }

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    client.params({
                        a: 'unsubscribe',
                        t: 'topic',
                        p: {
                            t: [pluginCreds.topicName]
                        }
                    })
                        .expect({
                            t: 'topic',
                            s: 0,
                            a: 'unsubscribe'
                        })
                        .send(done);
                }
            }
        }

        it('should receive notification from device with specified device_type', function (done) {
            runTest(conn, done);
        });

        it('should receive command notification with specified device_type', function (done) {
            runTestCommand(conn, done);
        });

        //this does not work, it seems that platform sends response 2 times
        it.skip('should receive command_update notification with specified device_type', function (done) {
            runTestCommandUpdate(conn, done)
        });

    });

    describe('#Plugin Subscription Network', function () {
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
                console.log(getResult);
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
                    console.log(getResult);
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
                    console.log(getResult);
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

    describe('#Plugin Subscription', function () {
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
                console.log(getResult);
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
                    console.log(getResult);
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
                    console.log(getResult);
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
                    'names', '',
                    'returnCommands', true,
                    'returnUpdatedCommands', true,
                    'returnNotifications', true
                );

                utils.createPlugin(path.current, params, function (err, result) {
                    callback();
                })
            }

            async.series([
                createPlugin
            ], done);
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
                console.log(result);
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true, 'Is array of 1 object');
                utils.matches(result[0], {
                    name: PLUGIN1
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
                console.log(result);
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
