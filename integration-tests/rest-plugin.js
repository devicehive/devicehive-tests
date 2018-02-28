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
    var paramObject = JSON.stringify({"asd": "asd"});

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
                networkId, {name: DEVICE, version: '1'});
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
                data: {name: PLUGIN}
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
        var deviceCreds;
        var testDevice;
        var conn = null;  
        var token = null; 

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
                        name: PLUGIN3,
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
                    deviceCreds = result;
                    // callback();
                    utils.getPlugin(path.PLUGIN, params, function (err, result) {
                        testDevice = result[0];
                        callback();
                    });
                    
                })
            }

            function updatePlugin(callback) {
                var params = {
                    jwt: utils.jwt.admin
                };
    
                params.query = path.query(
                    'topicName', deviceCreds.topicName,
                    'status', ACTIVE_STATUS
                );
    
                utils.updatePlugin(path.current, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    
                    params.query = path.query(
                        'topicName', deviceCreds.topicName
                    );
    
                    utils.getPlugin(path.current, params, function (err, result) {
                        testDevice = result[0];
                        console.log(testDevice);
                        callback();
                    });
                })
            }

            function getWsUrl(callback) {
                req.get(path.INFO).params({jwt: deviceCreds.accessToken}).send(function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    url = result.webSocketServerUrl;
                    callback();
                });
            }

            function createToken(callback) {
                var args = {
                    actions: [
                        'RegisterDevice',
                        'GetDeviceNotification',
                        'CreateDeviceNotification'
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

            function createConn(callback) {
                conn = new Websocket(url);
                conn.connect(callback);
            }
            //change deviceCreds to pluginCreds
            //change proxy url
            function authenticateConn(callback) {

                conn.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    // token: token
                    token: deviceCreds.accessToken
                    // token: utils.jwt.admin
                })
                    .send(callback);
            }

            async.series([
                createDevice,
                createPlugin, 
                updatePlugin,
                getWsUrl,
                createToken,
                createConn,
                authenticateConn
            ], done);
        });
        function runTest(client, done) {

            var requestId = getRequestId();
            var subscriptionId = null;
            client.params({
                    action: 'notification/subscribe',
                    requestId: requestId,

                    // token: deviceCreds.accessToken
                    // deviceId: DEVICE_ID,
                    // names: [NOTIFICATION]
                })
                .expect({
                    action: 'notification/subscribe',
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
                client.waitFor('notification/insert', cleanUp)
                    .expect({
                        action: 'notification/insert',
                        notification: { notification: NOTIFICATION },
                        subscriptionId: subscriptionId
                    });

                // req.create(path.NOTIFICATION.get('e50d6085-2aba-48e9-b1c3-73c673e414be'))
                //     .params({
                //         jwt: utils.jwt.admin,
                //         data: {notification: NOTIFICATION}
                //     })
                //     .send();
                
                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    client.params({
                            action: 'notification/unsubscribe',
                            requestId: getRequestId(),
                            subscriptionId: subscriptionId
                        })
                        .send(done);
                }
            }
        }
        it.only('should do smth',function(done) {
            runTest(conn,done);
        });
        it('should do it with plugin',function(done) {
            runTest(conn,done);
        });

        describe('##Events', function () {
            it('python1', function (done) {
                function insertNotification(callback) {
                    var params = {
                        jwt: utils.jwt.admin,
                        data: {
                            notification: NOTIFICATION,
                            parameters: {a: '1', b: '1'}
                        }
                    };
        
                    utils.create(path.NOTIFICATION.get(DEVICE_ID), params, function (err, result) {
                        if (err) {
                            return callback(err);
                        }
                        console.log(result);
        
                        notificationId1 = result.id;
                        timestamp = new Date().toISOString();
                        callback();
                    });
                }
                // insertNotification(done);
                
            });
            it('python2', function (done) {
                done();
            })
            it('python3', function (done) {
                done();
            })
            it('python4', function (done) {
                done();
            })
        });


    });

    describe('#Plugin Subscription DeviceType', function () {
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
            utils.getPlugin(PLUGIN_COUNT_PATH, {jwt: jwtWithPermissions}, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(result.count, 1);

                done();
            })
        });

        it('should get all user plugins', function (done) {
            utils.getPlugin(path.current, {jwt: jwtWithPermissions}, function (err, result) {
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
            utils.getPlugin(PLUGIN_COUNT_PATH, {jwt: utils.jwt.admin}, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(result.count > 0, true);

                done();
            })
        });

        it('should get all plugins with admin token', function (done) {
            utils.getPlugin(path.current, {jwt: utils.jwt.admin}, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                console.log(result);
                assert.strictEqual(result.length > 0, true);

                done();
            })
        });

        it('should fail with 403 on count all plugins for token without permission', function (done) {
            utils.getPlugin(PLUGIN_COUNT_PATH, {jwt: jwtWithoutPermissions}, function (err, result) {
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);

                done();
            })
        });

        it('should fail with 403 on list all plugins for token without permission', function (done) {
            utils.getPlugin(path.current, {jwt: jwtWithoutPermissions}, function (err, result) {
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);

                done();
            })
        });

        it('should fail with 403 on user counting other users\' plugins', function (done) {
            var params = {jwt: jwtWithPermissions};
            params.query = path.query('userId', 1);
            utils.getPlugin(PLUGIN_COUNT_PATH, params, function (err, result) {
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);

                done();
            })
        });

        it('should fail with 403 on user requesting other users\' plugins', function (done) {
            var params = {jwt: jwtWithPermissions};
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
