var assert = require('assert');
var async = require('async');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;

describe('REST API Plugin', function () {
    this.timeout(90000);

    var helper = utils.command;

    var NETWORK = utils.getName('network');
    var DEVICE = utils.getName('device');
    var PLUGIN = utils.getName('plugin');
    var PLUGIN1 = utils.getName('plugin');
    var DEVICE_ID = utils.getName('device-id');
    var COMMAND = utils.getName('cmd');
    var PLUGIN_COUNT_PATH = path.combine(path.PLUGIN_REGISTER, path.COUNT);
    
    var user = null;
    var jwtWithoutPermissions = null;
    var jwtWithPermissions = null;
    var commandId = null;
    var networkId = null;

    var description = 'Plugin Description';
    var paramObject = JSON.stringify({"asd": "asd"});

    before(function (done) {
        if (!utils.pluginUrl) {
            this.skip();
        }
        
        path.current = path.PLUGIN_REGISTER;

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
            createJWTWithoutPermissions,
            createJWTWithPermissions,
            createCommand
        ], done);
    });

    describe('#Plugin Register', function () {
        before(function() {
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

        it('should register plugin with admin token', function (done) {

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

                assert.equal(result.proxyEndpoint !==  null, true, 'Proxy endpoint is required');
                assert.equal(result.accessToken !== null, true, 'Access token is not returned');
                assert.equal(result.refreshToken !== null, true, 'Refresh token is not returned');
                
                done();
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
