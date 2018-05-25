var async = require('async');
var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/ws');
var getRequestId = utils.core.getRequestId;
var status = require('./common/http').status;

describe('WebSocket API Configuration', function () {
    this.timeout(90000);
    var url = null;

    var user = { id: 1 };

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
            connTokenAuth.on({
                action: 'authenticate',
                status: 'success'
            }, callback);

            connTokenAuth.send({
                action: 'authenticate',
                requestId: getRequestId(),
                token: token
            });
        }

        function authenticateConnInvalidTokenAuth(callback) {

            connInvalidTokenAuth.on({}, callback);

            connInvalidTokenAuth.send({
                action: 'authenticate',
                requestId: getRequestId(),
                token: invalidToken
            });
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
            connTokenAuth.on({
                action: 'configuration/get',
                requestId: requestId,
                status: 'success',
                configuration: {
                    name: configurationName,
                    value: configurationValue
                }
            }, done)
            connTokenAuth.send({
                action: 'configuration/get',
                requestId: requestId,
                name: configurationName
            });
        });
    });

    describe('#configuration/put', function () {
        var requestId = getRequestId();
        var configurationName = "ws_test_property";
        var configurationNameWith33symbols = "a11112222333344445555666677778888";
        var configurationValue = "ws_test_value_create";

        it('should create configuration', function (done) {
            connTokenAuth.on({
                action: 'configuration/put',
                requestId: requestId,
                status: 'success',
                configuration: {
                    name: configurationName,
                    value: configurationValue
                }
            }, done)
            connTokenAuth.send({
                action: 'configuration/put',
                requestId: requestId,
                name: configurationName,
                value: configurationValue
            });
        });

        it('should fail with 400 when configuration name\'s length exceeded', function (done) {
            connTokenAuth.on({
                code: status.BAD_REQUEST
            }, done)
            connTokenAuth.send({
                action: 'configuration/put',
                requestId: requestId,
                name: configurationNameWith33symbols,
                value: configurationValue
            });
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
                id: configurationName,
                data: { "value": configurationValue },
                jwt: utils.jwt.admin
            }, function (err, result) {
                if (err) {
                    return done(err);
                }
                done();
            });
        });

        it('should delete configuration', function (done) {

            connTokenAuth.on({
                action: 'configuration/delete',
                requestId: requestId,
                status: 'success'
            }, onDelete)
            connTokenAuth.send({
                action: 'configuration/delete',
                requestId: requestId,
                name: configurationName
            });

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

        it('should fail when delete non existing configuration', function (done) {
            var invalidConfigurationName = 'ws-invalid-configuration-name';

            connTokenAuth.on({
                code: status.NOT_FOUND,
                error: `Requested config with name = ${invalidConfigurationName} not found in the database`
            }, done)
            connTokenAuth.send({
                action: 'configuration/delete',
                requestId: requestId,
                name: invalidConfigurationName
            });
        });
    });

    describe('#Unauthorized', function () {
        var requestId = getRequestId();

        var configurationName = 'jwt.secret';
        var invalidConfigurationName = 'jwt.not-a-secret';
        var configurationValue = "test_value_delete";

        it('should fail with 403 if token is invalid', function (done) {
            connInvalidTokenAuth.on({
                code: status.FORBIDDEN,
                error: 'Access is denied'
            }, done)
            connInvalidTokenAuth.send({
                action: 'configuration/get',
                requestId: requestId,
                name: configurationName
            });
        });

        it('should fail with 403 when selecting configuration by not existing id, invalid auth parameters, no data',
            function (done) {
                connInvalidTokenAuth.on({
                    code: status.FORBIDDEN,
                    error: 'Access is denied'
                }, done)
                connInvalidTokenAuth.send({
                    action: 'configuration/get',
                    requestId: requestId,
                    name: invalidConfigurationName
                });
            }
        );

        it('should fail with 403 when updating configuration by not existing id, invalid auth parameters',
            function (done) {
                connInvalidTokenAuth.on({
                    code: status.FORBIDDEN,
                    error: 'Access is denied'
                }, done)
                connInvalidTokenAuth.send({
                    action: 'configuration/put',
                    requestId: requestId,
                    name: invalidConfigurationName,
                    value: configurationValue
                });
            }
        );

        it('should fail with 403 when deleting configuration with invalid auth parameters',
            function (done) {
                connInvalidTokenAuth.on({
                    code: status.FORBIDDEN,
                    error: 'Access is denied'
                }, done)
                connInvalidTokenAuth.send({
                    action: 'configuration/delete',
                    requestId: requestId,
                    name: invalidConfigurationName
                });
            }
        );
    });

    describe('#Not Found', function () {
        var requestId = getRequestId();
        var invalidConfigurationName = 'jwt.not-a-secret';

        it('should fail with 404 when selecting configuration by non-existing id', function (done) {
            connTokenAuth.on({
                code: status.NOT_FOUND,
                error: `Requested config with name = ${invalidConfigurationName} not found in the database`
            }, done)
            connTokenAuth.send({
                action: 'configuration/get',
                requestId: requestId,
                name: invalidConfigurationName
            });
        });

        it('should fail when deleting configuration by non-existing id', function (done) {
            connTokenAuth.on({
                code: status.NOT_FOUND,
                error: `Requested config with name = ${invalidConfigurationName} not found in the database`
            }, done)
            connTokenAuth.send({
                action: 'configuration/delete',
                requestId: requestId,
                name: invalidConfigurationName
            });
        });
    });

    after(function (done) {
        connTokenAuth.close();
        connInvalidTokenAuth.close();
        utils.clearDataJWT(done);
    });
});
