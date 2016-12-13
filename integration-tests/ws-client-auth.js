var async = require('async');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API Client Authentication', function () {
    this.timeout(90000);
    var url = null;

    var user = null;
    var token = null;
    var invalidToken = 'invalidToken';

    var NETWORK = utils.getName('ws-client-network');
    var NETWORK_KEY = utils.getName('ws-client-network-key');

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

        function createToken(callback) {
            var args = {
                actions: [
                    'GetDeviceNotification',
                    'GetDeviceCommand',
                    'CreateDeviceNotification',
                    'CreateDeviceCommand',
                    'UpdateDeviceCommand'
                ],
                networkIds: networkId,
                deviceGuid: void 0
            };
            utils.jwt.create(user.id, args.actions, args.networkIds, args.deviceGuid, function (err, result) {
                if (err) {
                    return callback(err);
                }
                token = result.accessToken;
                callback()
            })
        }

        async.series([
            getWsUrl,
            createNetwork,
            createUser,
            createToken
        ], done);
    });

    describe('#authenticate', function () {

        it('should authenticate using jwt', function (done) {
            var client = null;
            var requestId = getRequestId();

            function createConnection(callback) {
                client = new Websocket(url, 'client');
                client.connect(callback);
            }

            function runTest(callback) {
                client.params({
                    action: 'authenticate',
                    requestId: requestId,
                    token: token
                })
                    .expect({
                        action: 'authenticate',
                        status: 'success',
                        requestId: requestId
                    })
                    .send(callback);
            }

            async.series([
                createConnection,
                runTest
            ], function (err) {
                if (client) {
                    client.close();
                }

                done(err);
            });
        });

        it('should return error when using invalid jwt', function (done) {
            var client = null;

            function createConnection(callback) {
                client = new Websocket(url, 'client');
                client.connect(callback);
            }

            function runTest(callback) {
                client.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token:  invalidToken
                })
                    .expectError(401, 'Invalid credentials')
                    .send(callback);
            }

            async.series([
                createConnection,
                runTest
            ], function (err) {
                if (client) {
                    client.close();
                }

                done(err);
            });
        });
    });

    describe('#token/refresh', function () {
        it('should refresh access token using refresh jwt', function (done) {
            var client = null;
            var requestId = getRequestId();

            function createConnection(callback) {
                client = new Websocket(url, 'client');
                client.connect(callback);
            }

            function runTest(callback) {
                client.params({
                    action: 'token/refresh',
                    requestId: requestId,
                    refreshToken: utils.jwt.admin_refresh
                })
                    .expect({
                        action: 'token/refresh',
                        status: 'success',
                        requestId: requestId
                    })
                    .send(callback);
            }

            async.series([
                createConnection,
                runTest
            ], function (err) {
                if (client) {
                    client.close();
                }

                done(err);
            });
        });

        it('should return error when refreshing access token with invalid jwt', function (done) {
            var client = null;

            function createConnection(callback) {
                client = new Websocket(url, 'client');
                client.connect(callback);
            }

            function runTest(callback) {
                client.params({
                    action: 'token/refresh',
                    requestId: getRequestId(),
                    token:  utils.jwt.admin_refresh_invalid
                })
                    .expectError(401, 'Invalid credentials')
                    .send(callback);
            }

            async.series([
                createConnection,
                runTest
            ], function (err) {
                if (client) {
                    client.close();
                }

                done(err);
            });
        });

        it('should return error when refreshing access token with expired jwt', function (done) {
            var client = null;

            function createConnection(callback) {
                client = new Websocket(url, 'client');
                client.connect(callback);
            }

            function runTest(callback) {
                client.params({
                    action: 'token/refresh',
                    requestId: getRequestId(),
                    token:  utils.jwt.admin_refresh_exp
                })
                    .expectError(401, 'Invalid credentials')
                    .send(callback);
            }

            async.series([
                createConnection,
                runTest
            ], function (err) {
                if (client) {
                    client.close();
                }

                done(err);
            });
        });
    });

    after(function (done) {
        utils.clearDataJWT(done);
    });
});
