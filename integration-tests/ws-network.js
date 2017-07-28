var async = require('async');
var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API Network', function () {
    this.timeout(90000);
    var url = null;

    var NETWORK1 = utils.getName('ws-network-1');
    var NETWORK2 = utils.getName('ws-network-2');
    var token = null;

    before(function (done) {
        req.get(path.INFO).params({jwt: utils.jwt.admin}).send(function (err, result) {
            if (err) {
                return done(err);
            }
            url = result.webSocketServerUrl;
            done();
        });
    });

    describe('#network/get', function () {

        var conn = null;
        var networkId = null;

        before(function (done) {
            function createNetwork(callback) {
                var params = {
                    jwt: utils.jwt.admin,
                    data: { name: NETWORK1 }
                };

                utils.create(path.NETWORK, params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    networkId = result.id;
                    callback();
                });
            }

            function createConn(callback) {
                conn = new Websocket(url);
                conn.connect(callback);
            }

            function createToken(callback) {
                var args = {
                    actions: [
                        'GetNetwork',
                        'ManageNetwork'
                    ],
                    networkIds: networkId
                };
                utils.jwt.create(utils.admin.id, args.actions, args.networkIds, args.deviceIds, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    token = result.accessToken;
                    callback()
                })
            }

            function authenticateConn(callback) {
                conn.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: token
                })
                    .send(callback);
            }

            async.series([
                createNetwork,
                createToken,
                createConn,
                authenticateConn
            ], done);
        });

        it('should not get information about network without id', function (done) {
            var requestId = getRequestId();

            conn.params({
                action: 'network/get',
                requestId: requestId
            })
                .expectError(400, 'Network id is wrong or empty')
                .send(done);
        });

        it('should return 400 when id is null', function (done) {
            var requestId = getRequestId();

            conn.params({
                action: 'network/get',
                requestId: requestId,
                id: null
            })
                .expectError(400, 'Network id is wrong or empty')
                .send(done);
        });

        it('should return 404 when no network exists', function (done) {
            var requestId = getRequestId();

            conn.params({
                action: 'network/get',
                id: utils.NON_EXISTING_ID,
                requestId: requestId
            })
                .expectError(404, 'Network with id = ' + utils.NON_EXISTING_ID + ' not found')
                .send(done);
        });

        after(function (done) {
            conn.close();
            utils.clearDataJWT(done);
        });
    });

    describe('#network/list', function () {

        var conn = null;
        var networkId1 = null;
        var networkId2 = null;

        before(function (done) {
            function createNetwork1(callback) {
                var params = {
                    jwt: utils.jwt.admin,
                    data: { name: NETWORK1 }
                };

                utils.create(path.NETWORK, params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    networkId1 = result.id;
                    callback();
                });
            }

            function createNetwork2(callback) {
                var params = {
                    jwt: utils.jwt.admin,
                    data: { name: NETWORK2 }
                };

                utils.create(path.NETWORK, params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    networkId2 = result.id;
                    callback();
                });
            }

            function createConn(callback) {
                conn = new Websocket(url);
                conn.connect(callback);
            }

            function createToken(callback) {
                var args = {
                    actions: [
                        'GetNetwork',
                        'ManageNetwork'
                    ],
                    networkIds: [networkId1, networkId2]
                };
                utils.jwt.create(utils.admin.id, args.actions, args.networkIds, args.deviceIds, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    token = result.accessToken;
                    callback()
                })
            }

            function authenticateConn(callback) {
                conn.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: token
                })
                    .send(callback);
            }

            async.series([
                createNetwork1,
                createNetwork2,
                createToken,
                createConn,
                authenticateConn
            ], done);
        });

        it('should get the first network only', function (done) {
            var requestId = getRequestId();

            var expectedNetwork = {
                name: NETWORK1,
                id: networkId1,
                description: null
            };

            conn.params({
                action: 'network/list',
                requestId: requestId,
                namePattern: '%ws-network-1%'
            })
                .expect({
                    action: 'network/list',
                    requestId: requestId,
                    status: 'success',
                    networks: [expectedNetwork]
                })
                .send(done);
        });

        it('should get networks in correct order', function (done) {
            var requestId = getRequestId();

            var expectedNetwork1 = {
                name: NETWORK1,
                id: networkId1,
                description: null
            };
            var expectedNetwork2 = {
                name: NETWORK2,
                id: networkId2,
                description: null
            };

            conn.params({
                action: 'network/list',
                requestId: requestId,
                sortField: 'name',
                sortOrderAsc: 'true'
            })
                .expect({
                    action: 'network/list',
                    requestId: requestId,
                    status: 'success',
                    networks: [expectedNetwork1, expectedNetwork2]
                })
                .send(done);
        });

        after(function (done) {
            conn.close();
            utils.clearDataJWT(done);
        });
    });

    describe('#network/insert', function () {

        var conn = null;

        before(function (done) {
            function createConn(callback) {
                conn = new Websocket(url);
                conn.connect(callback);
            }

            function createToken(callback) {
                var args = {
                    actions: [
                        'GetNetwork',
                        'ManageNetwork'
                    ]
                };
                utils.jwt.create(utils.admin.id, args.actions, args.networkIds,  args.deviceIds, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    token = result.accessToken;
                    callback()
                })
            }

            function authenticateConn(callback) {
                conn.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: token
                })
                    .send(callback);
            }

            async.series([
                createToken,
                createConn,
                authenticateConn
            ], done);
        });

        it('should insert network', function (done) {
            var requestId = getRequestId();

            conn.params({
                action: 'network/insert',
                requestId: requestId,
                network: { name: NETWORK1 }
            })
                .expect({
                    action: 'network/insert',
                    requestId: requestId,
                    status: 'success'
                })
                .send(done);
        });

        after(function (done) {
            conn.close();
            utils.clearDataJWT(done);
        });
    });

    describe('#network/delete', function () {

        var conn = null;
        var networkId = null;

        before(function (done) {
            function createNetwork(callback) {
                var params = {
                    jwt: utils.jwt.admin,
                    data: { name: NETWORK1 }
                };

                utils.create(path.NETWORK, params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    networkId = result.id;
                    callback();
                });
            }

            function createConn(callback) {
                conn = new Websocket(url);
                conn.connect(callback);
            }

            function createToken(callback) {
                var args = {
                    actions: [
                        'GetNetwork',
                        'ManageNetwork'
                    ],
                    networkIds: networkId
                };
                utils.jwt.create(utils.admin.id, args.actions, args.networkIds,  args.deviceIds, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    token = result.accessToken;
                    callback()
                })
            }

            function authenticateConn(callback) {
                conn.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: token
                })
                    .send(callback);
            }

            async.series([
                createNetwork,
                createToken,
                createConn,
                authenticateConn
            ], done);
        });

        it('should return error for invalid network id', function(done) {
            var requestId = getRequestId();

            conn.params({
                action: 'network/delete',
                requestId: requestId,
                id: utils.NON_EXISTING_ID
            })
                .expectError(404, 'Network with id = ' + utils.NON_EXISTING_ID + ' not found')
                .send(done);
        });

        it('should delete network', function (done) {

            function deleteNetwork(callback) {
                var requestId = getRequestId();
                conn.params({
                    action: 'network/delete',
                    requestId: requestId,
                    id: networkId
                })
                    .expect({
                        action: 'network/delete',
                        requestId: requestId,
                        status: 'success'
                    })
                    .send(callback);
            }

            function checkNetwork(callback) {
                req.get(path.NETWORK)
                    .params({jwt: utils.jwt.admin, id: networkId})
                    .expectError(404, 'Network with id = ' + networkId + ' not found')
                    .send(callback);
            }

            async.series([
                deleteNetwork,
                checkNetwork
            ], done);
        });

        after(function (done) {
            conn.close();
            utils.clearDataJWT(done);
        });
    });
});

