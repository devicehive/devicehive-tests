var async = require('async');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API Client Authentication', function () {
    this.timeout(30000);
    var url = null;

    var user = null;
    var accessKey = null;

    var invalidUser = {
        login: 'invalidUser',
        password: 'invalidPass'
    };
    var invalidAccessKey = 'qwertyuiopasdfghjklzxcvbnm1234567890ASDFGHJ=';

    var NETWORK = utils.getName('ws-client-network');
    var NETWORK_KEY = utils.getName('ws-client-network-key');

    before(function (done) {

        var networkId = null;

        function getWsUrl(callback) {

            req.get(path.INFO).params({user: utils.admin}).send(function (err, result) {
                if (err) {
                    return callback(err);
                }
                url = result.webSocketServerUrl;
                callback();
            });
        }

        function createNetwork(callback) {
            var params = {
                user: utils.admin,
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

        function createAccessKey(callback) {
            var args = {
                label: utils.getName('ws-access-key'),
                actions: [
                    'GetDeviceNotification',
                    'GetDeviceCommand',
                    'CreateDeviceNotification',
                    'CreateDeviceCommand',
                    'UpdateDeviceCommand'
                ],
                networkIds: networkId
            };
            utils.accessKey.create(utils.admin, args.label, args.actions, void 0, args.networkIds,
                function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    accessKey = result.key;
                    callback();
                })
        }

        async.series([
            getWsUrl,
            createNetwork,
            createUser,
            createAccessKey
        ], done);
    });

    describe('#authenticate', function () {

        it('should authenticate using login and password', function (done) {
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
                        login:  user.login,
                        password: user.password
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

        it('should authenticate using access key', function (done) {
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
                        accessKey:  accessKey
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

        it('should return error when using invalid login and password', function (done) {
            var client = null;

            function createConnection(callback) {
                client = new Websocket(url, 'client');
                client.connect(callback);
            }

            function runTest(callback) {
                client.params({
                        action: 'authenticate',
                        requestId: getRequestId(),
                        login:  invalidUser.login,
                        password: invalidUser.password
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

        it('should return error when using invalid access key', function (done) {
            var client = null;

            function createConnection(callback) {
                client = new Websocket(url, 'client');
                client.connect(callback);
            }

            function runTest(callback) {
                client.params({
                        action: 'authenticate',
                        requestId: getRequestId(),
                        accessKey:  invalidAccessKey
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
        utils.clearData(done);
    });
});
