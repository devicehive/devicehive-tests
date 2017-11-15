var async = require('async');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;
var status = require('./common/http').status;

describe('WebSocket API Authentication', function () {
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

            utils.get(path.INFO, {jwt: utils.jwt.admin} ,function (err, result) {
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
                deviceTypeIds: void 0,
                deviceId: void 0
            };
            utils.jwt.create(user.id, args.actions, args.networkIds, args.deviceTypeIds, args.deviceId, function (err, result) {
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
                client = new Websocket(url);
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
                client = new Websocket(url);
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

        it('should return error when using refresh jwt', function (done) {
            var client = null;

            function createConnection(callback) {
                client = new Websocket(url);
                client.connect(callback);
            }

            function runTest(callback) {
                client.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token:  utils.jwt.admin_refresh
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

    describe('#token', function () {
        it('should get tokens using login and password', function (done) {
            var client = null;
            var requestId = getRequestId();

            function createConnection(callback) {
                client = new Websocket(url);
                client.connect(callback);
            }

            function runTest(callback) {
                client.params({
                    action: 'token',
                    requestId: requestId,
                    login: user.login,
                    password: utils.NEW_USER_PASSWORD
                })
                    .expect({
                        action: 'token',
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

        it('should return error using invalid password', function (done) {
            var client = null;
            var requestId = getRequestId();

            function createConnection(callback) {
                client = new Websocket(url);
                client.connect(callback);
            }

            function runTest(callback) {
                client.params({
                    action: 'token',
                    requestId: requestId,
                    login: user.login,
                    password: "123"
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

        it('should return error using invalid login', function (done) {
            var client = null;
            var requestId = getRequestId();

            function createConnection(callback) {
                client = new Websocket(url);
                client.connect(callback);
            }

            function runTest(callback) {
                client.params({
                    action: 'token',
                    requestId: requestId,
                    login: 'invalid-login',
                    password: 'invalid-password'
                })
                    .expectError(401, 'User with login = invalid-login not found or bad password')
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

    describe('#token/create', function () {
        it('should create tokens using admin authentication', function (done) {
            var client = null;
            var requestId = getRequestId();

            function createConnection(callback) {
                client = new Websocket(url);
                client.connect(callback);
            }

            function authenticateConn(callback) {
                client.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: utils.jwt.admin
                })
                    .send(callback);
            }

            function runTest(callback) {
                client.params({
                    action: 'token/create',
                    requestId: requestId,
                    payload: {userId: user.id}
                })
                    .expect({
                        action: 'token/create',
                        status: 'success',
                        requestId: requestId
                    })
                    .send(callback);
            }

            async.series([
                createConnection,
                authenticateConn,
                runTest
            ], function (err) {
                if (client) {
                    client.close();
                }

                done(err);
            });
        });

        it('should return error using client authentication', function (done) {
            var client = null;
            var requestId = getRequestId();

            function createConnection(callback) {
                client = new Websocket(url);
                client.connect(callback);
            }

            function authenticateConn(callback) {
                client.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: token
                })
                    .send(callback);
            }

            function runTest(callback) {
                client.params({
                    action: 'token/create',
                    requestId: requestId,
                    payload: {userId: user.id}
                })
                    .expectError(403, 'Access is denied')
                    .send(callback);
            }

            async.series([
                createConnection,
                authenticateConn,
                runTest
            ], function (err) {
                if (client) {
                    client.close();
                }

                done(err);
            });
        });

        it('should return error without authentication', function (done) {
            var client = null;
            var requestId = getRequestId();

            function createConnection(callback) {
                client = new Websocket(url);
                client.connect(callback);
            }

            function runTest(callback) {
                client.params({
                    action: 'token/create',
                    requestId: requestId,
                    payload: {userId: user.id}
                })
                    .expectError(401, 'Unauthorized')
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

        it('should return error with invalid payload', function (done) {
            var client = null;
            var requestId = getRequestId();

            function createConnection(callback) {
                client = new Websocket(url);
                client.connect(callback);
            }

            function authenticateConn(callback) {
                client.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: utils.jwt.admin
                })
                    .send(callback);
            }

            function runTest(callback) {
                client.params({
                    action: 'token/create',
                    requestId: requestId,
                    payload: {userId: -1}
                })
                    .expectError(404, 'User with id = -1 not found')
                    .send(callback);
            }

            async.series([
                createConnection,
                authenticateConn,
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
                client = new Websocket(url);
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
                client = new Websocket(url);
                client.connect(callback);
            }

            function runTest(callback) {
                client.params({
                    action: 'token/refresh',
                    requestId: getRequestId(),
                    refreshToken:  utils.jwt.admin_refresh_invalid
                })
                    .expectError(status.NOT_AUTHORIZED, 'Invalid token type')
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
                client = new Websocket(url);
                client.connect(callback);
            }

            function runTest(callback) {
                client.params({
                    action: 'token/refresh',
                    requestId: getRequestId(),
                    refreshToken:  utils.jwt.admin_refresh_exp
                })
                    .expectError(status.NOT_AUTHORIZED, 'Token has expired')
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
