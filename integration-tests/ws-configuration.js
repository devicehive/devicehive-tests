var async = require('async');
var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;
var status = require('./common/http').status;

describe('WebSocket API Configuration', function () {
    this.timeout(90000);
    var url = null;
    
    var user = {id: 1};
    
    var connTokenAuth = null;
    var connInvalidTokenAuth = null;
    
    var token = null;
    var invalidToken = null;

    before(function (done) {
        path.current = path.CONFIGURATION;

        function getUrl(callback) {
            utils.get(path.INFO, {
                jwt: utils.jwt.admin
            }, function (err, result) {
                if (err) {
                    return callback(err);
                }
                url = result.webSocketServerUrl;
                callback();
            });
        }
        
        function createConnTokenAuth(callback) {
            connTokenAuth = new Websocket(url);
            connTokenAuth.connect(callback);
        }

        function createConnInvalidTokenAuth(callback) {
            connInvalidTokenAuth = new Websocket(url);
            connInvalidTokenAuth.connect(callback);
        }

        function createToken(callback) {
            var args = {
                actions: [
                    'ManageConfiguration'
                ],
                deviceIds: void 0,
                networkIds: void 0,
                deviceTypeIds: void 0
            };
            utils.jwt.create(utils.admin.id, args.actions, args.networkIds, args.deviceTypeIds,
                function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    token = result.accessToken;
                    callback()
                }
            )
        }

        function createInvalidToken(callback) {
            var args = {
                actions: [
                    'GetNetwork'
                ],
                deviceIds: void 0,
                networkIds: void 0,
                deviceTypeIds: void 0
            };
            
            utils.jwt.create(user.id, args.actions, args.networkIds, args.deviceTypeIds,
                function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    invalidToken = result.accessToken;
                    callback()
                }
            )
        }

        function authenticateConnTokenAuth(callback) {
            connTokenAuth.params({
                action: 'authenticate',
                requestId: getRequestId(),
                token: token
            })
                .send(callback);
        }

        function authenticateConnInvalidTokenAuth(callback) {
            connInvalidTokenAuth.params({
                action: 'authenticate',
                requestId: getRequestId(),
                token: invalidToken
            })
                .send(callback);
        }

        async.series([
            getUrl,
            createToken,
            createInvalidToken,
            createConnTokenAuth,
            createConnInvalidTokenAuth,
            authenticateConnTokenAuth,
            authenticateConnInvalidTokenAuth
        ], done);
    });
    
    describe('#configuration/get', function () {
        var requestId = getRequestId();
        var configurationName = 'jwt.secret';
        var configurationValue = 'devicehive';

        it('should get jwt.secret', function (done) {
            connTokenAuth.params({
                action: 'configuration/get',
                requestId: requestId,
                name: configurationName
            })
                .expect({
                    action: 'configuration/get',
                    requestId: requestId,
                    status: 'success'
                })
                .assert(function (result) {
                    assert.equal(result.configuration.name, configurationName,
                        "Should have expected configuration name");
                    assert.equal(result.configuration.value, configurationValue,
                        "Should have expected configuration value");
                })

                .send(done);
        });
    });

    describe('#configuration/put', function () {
        var requestId = getRequestId();
        var configurationName = "ws_test_property";
        var configurationNameWith33symbols = "a11112222333344445555666677778888";
        var configurationValue = "ws_test_value_create";

        it('should create configuration', function (done) {
            connTokenAuth.params({
                action: 'configuration/put',
                requestId: requestId,
                name: configurationName,
                value: configurationValue
            })
                .expect({
                    action: 'configuration/put',
                    requestId: requestId,
                    status: 'success'
                })
                .assert(function (result) {
                    assert.equal(result.configuration.name, configurationName,
                        "Should have expected configuration name");
                    assert.equal(result.configuration.value, configurationValue,
                        "Should have expected configuration value");
                })
                .send(done);
            
        });

        it('should fail with 400 when configuration name\'s length exceeded', function (done) {
            connTokenAuth.params({
                action: 'configuration/put',
                requestId: requestId,
                name: configurationNameWith33symbols,
                value: configurationValue
            })
                .expectError(status.BAD_REQUEST)
                .send(done);
        });

        after(function (done) {
            utils.delete(path.current, {
                    id: configurationName,
                    jwt: utils.jwt.admin
                }, function (err, result) {
                if (err) {
                    return done(err);
                }
                done();
            });
        });
    });

    describe('#configuration/delete', function () {
        var requestId = getRequestId();
        var configurationName = "ws_test_name_delete";
        var configurationValue = "ws_test_value_delete";

        before(function (done) {
            utils.update(path.current, {
                    id:  configurationName,
                    data: {"value": configurationValue},
                    jwt: utils.jwt.admin
                }, function (err, result) {
                if (err) {
                    return done(err);
                }
                done();
            });
        });

        it('should delete configuration', function(done){

            connTokenAuth.params({
                action: 'configuration/delete',
                requestId: requestId,
                name: configurationName
            })
                .expect({
                    action: 'configuration/delete',
                    requestId: requestId,
                    status: 'success'
                })
                .send(onDelete);

            function onDelete(err, result) {
                if (err) {
                    return done(err);
                }

                utils.get(path.current, {
                    id: configurationName,
                    jwt: utils.jwt.admin
                }, function (err, result) {
                    if (err) {
                        return done();
                    }
                    done(result);
                });
            }

            
        });

        it('should fail when delete non existing configuration', function(done){
            var invalidConfigurationName = 'ws-invalid-configuration-name';
            connTokenAuth.params({
                action: 'configuration/delete',
                requestId: requestId,
                name: invalidConfigurationName
            })
                .expectError(status.NOT_FOUND, 'Requested config with name = ' + 
                    invalidConfigurationName + ' not found in the database')
                .send(done);
        });
    });

    describe('#Unauthorized', function () {
        var requestId = getRequestId();
        
        var configurationName = 'jwt.secret';
        var invalidConfigurationName = 'jwt.not-a-secret';
        var configurationValue = "test_value_delete";

        it('should fail with 403 if token is invalid', function (done) {
            connInvalidTokenAuth.params({
                action: 'configuration/get',
                requestId: requestId,
                name: configurationName
            })
                .expectError(status.FORBIDDEN, 'Access is denied')
                .send(done);
        });

        it('should fail with 403 when selecting configuration by not existing id, invalid auth parameters, no data',
            function (done) {
                connInvalidTokenAuth.params({
                    action: 'configuration/get',
                    requestId: requestId,
                    name: invalidConfigurationName
                })
                    .expectError(status.FORBIDDEN, 'Access is denied')
                    .send(done);
            }
        );

        it('should fail with 403 when updating configuration by not existing id, invalid auth parameters',
            function (done) {
                connInvalidTokenAuth.params({
                    action: 'configuration/put',
                    requestId: requestId,
                    name: invalidConfigurationName,
                    value: configurationValue
                })
                    .expectError(status.FORBIDDEN, 'Access is denied')
                    .send(done);
            }
        );

        it('should fail with 403 when deleting configuration with invalid auth parameters',
            function (done) {
                connInvalidTokenAuth.params({
                    action: 'configuration/delete',
                    requestId: requestId,
                    name: invalidConfigurationName
                })
                    .expectError(status.FORBIDDEN, 'Access is denied')
                    .send(done);
            }
        );
    });

    describe('#Not Found', function () {
        var requestId = getRequestId();
        var invalidConfigurationName = 'jwt.not-a-secret';

        it('should fail with 404 when selecting configuration by non-existing id', function (done) {
            connTokenAuth.params({
                action: 'configuration/get',
                requestId: requestId,
                name: invalidConfigurationName
            })
                .expectError(status.NOT_FOUND, 'Requested config with name = ' + 
                    invalidConfigurationName + ' not found in the database')
                .send(done);
        });

        it('should fail when deleting configuration by non-existing id', function (done) {
            connTokenAuth.params({
                action: 'configuration/delete',
                requestId: requestId,
                name: invalidConfigurationName
            })
                .expectError(status.NOT_FOUND, 'Requested config with name = ' + 
                    invalidConfigurationName + ' not found in the database')
                .send(done);
        });
    });

    after(function (done) {
        connTokenAuth.close();
        connInvalidTokenAuth.close();
        utils.clearDataJWT(done);
    });
});
