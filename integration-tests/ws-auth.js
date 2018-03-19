var async = require('async');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/ws');
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

            utils.get(path.INFO, { jwt: utils.jwt.admin }, function (err, result) {
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
            utils.jwt.create(user.id, args.actions, args.networkIds, args.deviceTypeIds, function (err, result) {
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
                client.on({
                    action: 'authenticate',
                    status: 'success',
                    requestId: requestId
                }, callback);

                client.send({
                    action: 'authenticate',
                    requestId: requestId,
                    token: token
                });
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
                client.on({
                    error: 'Invalid credentials',
                    code: 401
                }, callback);

                client.send({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: invalidToken
                });
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

                client.on({
                    error: 'Invalid credentials',
                    code: 401
                }, callback);

                client.send({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: utils.jwt.admin_refresh
                });
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
                client.on({
                    action: 'token',
                    status: 'success',
                    requestId: requestId
                }, callback);

                client.send({
                    action: 'token',
                    requestId: requestId,
                    login: user.login,
                    password: utils.NEW_USER_PASSWORD
                });
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
                client.on({
                    code: 401,
                    error: 'Invalid credentials'
                }, callback);

                client.send({
                    action: 'token',
                    requestId: requestId,
                    login: user.login,
                    password: '123'
                });
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
                client.on({
                    code: 401,
                    error: 'User with login = invalid-login not found or bad password'
                }, callback);

                client.send({
                    action: 'token',
                    requestId: requestId,
                    login: 'invalid-login',
                    password: 'invalid-password'
                });
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

                client.on({
                    action: 'authenticate',
                    status: 'success'
                }, callback);

                client.send({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: utils.jwt.admin
                });
            }

            function runTest(callback) {
                client.on({
                    action: 'token/create',
                    status: 'success',
                    requestId: requestId
                }, callback);

                client.send({
                    action: 'token/create',
                    requestId: requestId,
                    payload: { userId: user.id }
                });
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
                client.on({
                    action: 'authenticate',
                    status: 'success'
                }, callback);

                client.send({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: token
                });
            }

            function runTest(callback) {
                client.on({
                    code: 403,
                    error: 'Access is denied'
                }, callback);

                client.send({
                    action: 'token/create',
                    requestId: requestId,
                    payload: { userId: user.id }
                });
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
                client.on({
                    code: 401,
                    error: 'Unauthorized'
                }, callback);

                client.send({
                    action: 'token/create',
                    requestId: requestId,
                    payload: { userId: user.id }
                });
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
                client.on({
                    action: 'authenticate',
                    status: 'success'
                }, callback);

                client.send({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: utils.jwt.admin
                });
            }

            function runTest(callback) {
                client.on({
                    code: 404,
                    error: 'User with id = -1 not found'
                }, callback);

                client.send({
                    action: 'token/create',
                    requestId: requestId,
                    payload: { userId: -1 }
                });
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
                client.on({
                    action: 'token/refresh',
                    status: 'success',
                    requestId: requestId
                }, callback);

                client.send({
                    action: 'token/refresh',
                    requestId: requestId,
                    refreshToken: utils.jwt.admin_refresh
                });
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

                client.on({
                    error: 'Invalid token type',
                    code: status.NOT_AUTHORIZED
                }, callback);

                client.send({
                    action: 'token/refresh',
                    requestId: getRequestId(),
                    refreshToken: utils.jwt.admin_refresh_invalid
                });
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
                client.on({
                    error: 'Token has expired',
                    code: status.NOT_AUTHORIZED
                }, callback);

                client.send({
                    action: 'token/refresh',
                    requestId: getRequestId(),
                    refreshToken: utils.jwt.admin_refresh_exp
                });
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
