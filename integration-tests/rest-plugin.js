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
    var DEVICE_ID = utils.getName('device-id');
    var COMMAND = utils.getName('cmd');
    
    var user = null;
    var jwtWithoutPermissions = null;
    var commandId = null;
    var networkId = null;
    var timestamp = new Date().getTime();

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
            utils.jwt.create(user.id, ['CreateDeviceCommand', 'GetDeviceCommand', 'UpdateDeviceCommand'], [networkId], [DEVICE_ID], function (err, result) {
                if (err) {
                    return callback(err);
                }
                jwtWithoutPermissions = result.accessToken;
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
            createCommand
        ], done);
    });

    describe('#Plugin Register', function () {

        it('should not register plugin without ManagePlugin permission', function (done) {
            var params = {
                jwt: jwtWithoutPermissions,
                data: { name: PLUGIN }
            };
            params.query = path.query('deviceIds', DEVICE_ID, 'pollType', 'Command', 'timestamp', timestamp);
            
            utils.createPlugin(path.current, params, function (err, result) {
                assert.strictEqual(err.error, 'Access is denied');
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);

                done();
            })
        });

        it('should register plugin with admin token', function (done) {
            var description = 'Plugin Description';
            var healthCheckUrl = utils.pluginUrl + '/info';
            var paramObject = JSON.stringify({"asd": "asd"});
            var proxyEndpointLocal = 'localhost:3000';
            var proxyEndpointDocker = 'kafkaproxy:3000';
            
            var params = {
                jwt: utils.jwt.admin,
                data: {
                    name: PLUGIN,
                    description: description,
                    healthCheckUrl: healthCheckUrl,
                    parameters: {
                        jsonString: paramObject
                    }
                }
            };
            params.query = path.query(
                'deviceIds', DEVICE_ID,
                'networkIds', networkId,
                'names', '',
                'timestamp', timestamp,
                'returnCommands', true,
                'returnUpdatedCommands', true,
                'returnNotifications', true
            );
            

            utils.createPlugin(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                
                var isCorrectProxyEndpoint = result.proxyEndpoint === proxyEndpointLocal
                    || result.proxyEndpoint === proxyEndpointDocker; 
                assert.equal(isCorrectProxyEndpoint, true, 'Wrong proxy endpoint');
                assert.equal(result.accessToken !== null, true, 'Access token is not returned');
                assert.equal(result.refreshToken !== null, true, 'Refresh token is not returned');
                
                done();
            })
        });

    });

    
    after(function (done) {
        utils.clearDataJWT(done);
    });
});
