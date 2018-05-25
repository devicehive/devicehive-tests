var async = require('async');
var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var status = require('./common/http').status;
var Websocket = require('./common/ws');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API Network', function () {
    this.timeout(90000);
    var url = null;

    var NETWORK1 = utils.getName('ws-network-1');
    var NETWORK2 = utils.getName('ws-network-2');
    var token = null;
    var noActionsToken = null;

    before(function (done) {
        req.get(path.INFO).params({ jwt: utils.jwt.admin }).send(function (err, result) {
            if (err) {
                return done(err);
            }
            url = result.webSocketServerUrl;
            done();
        });
    });

    describe('#network/get', function () {

        var conn = null;
        var adminConn = null;
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

            function createAdminConn(callback) {
                adminConn = new Websocket(url);
                adminConn.connect(callback);
            }

            function createToken(callback) {
                var args = {
                    actions: [
                        'GetNetwork',
                        'ManageNetwork'
                    ],
                    networkIds: networkId
                };
                utils.jwt.create(utils.admin.id, args.actions, args.networkIds, args.deviceTypeIds, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    token = result.accessToken;
                    callback()
                })
            }

            function authenticateConn(callback) {

                conn.on({
                    action: 'authenticate',
                    status: 'success'
                }, callback);

                conn.send({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: token
                });
            }

            function authenticateAdminConn(callback) {
                adminConn.on({
                    action: 'authenticate',
                    status: 'success'
                }, callback);

                adminConn.send({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: utils.jwt.admin
                });
            }

            async.series([
                createNetwork,
                createToken,
                createConn,
                createAdminConn,
                authenticateConn,
                authenticateAdminConn
            ], done);
        });

        it('should not get information about network without id', function (done) {
            var requestId = getRequestId();

            conn.on({
                code: 400,
                error: 'Network id is wrong or empty'
            }, done)

            conn.send({
                action: 'network/get',
                requestId: requestId
            });
        });

        it('should return 400 when id is null', function (done) {
            var requestId = getRequestId();

            conn.on({
                code: 400,
                error: 'Network id is wrong or empty'
            }, done)

            conn.send({
                action: 'network/get',
                requestId: requestId,
                id: null
            });
        });

        it('should return 403 when no network exists with client token', function (done) {
            var requestId = getRequestId();

            conn.on({
                code: 403,
                error: 'Access is denied'
            }, done)

            conn.send({
                action: 'network/get',
                networkId: utils.NON_EXISTING_ID,
                requestId: requestId
            });
        });

        it('should return 404 when no network exists with admin token', function (done) {
            var requestId = getRequestId();

            adminConn.on({
                code: 404,
                error: 'Network with id = ' + utils.NON_EXISTING_ID + ' not found'
            }, done);

            adminConn.send({
                action: 'network/get',
                networkId: utils.NON_EXISTING_ID,
                requestId: requestId
            });
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
        var noActionsConnection = null;

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

            function createNoActionsConnection(callback) {
                noActionsConnection = new Websocket(url);
                noActionsConnection.connect(callback);
            }

            function createToken(callback) {
                var args = {
                    actions: [
                        'GetNetwork',
                        'ManageNetwork'
                    ],
                    networkIds: [networkId1, networkId2]
                };
                utils.jwt.create(utils.admin.id, args.actions, args.networkIds, args.deviceTypeIds, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    token = result.accessToken;
                    callback()
                })
            }

            function createNoActionsToken(callback) {
                var args = {
                    actions: void 0,
                    networkIds: [networkId1, networkId2],
                    deviceTypeIds: void 0
                };
                utils.jwt.create(utils.admin.id, args.actions, args.networkIds, args.deviceTypeIds, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    noActionsToken = result.accessToken;
                    callback()
                })
            }

            function authenticateConn(callback) {
                conn.on({
                    action: 'authenticate',
                    status: 'success'
                }, callback);

                conn.send({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: token
                });
            }

            function authenticateNoActionsConnection(callback) {
                noActionsConnection.on({
                    action: 'authenticate',
                    status: 'success'
                }, callback);

                noActionsConnection.send({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: noActionsToken
                });
            }

            async.series([
                createNetwork1,
                createNetwork2,
                createToken,
                createNoActionsToken,
                createConn,
                createNoActionsConnection,
                authenticateConn,
                authenticateNoActionsConnection
            ], done);
        });

        it('should count networks based on the name pattern', function (done) {
            var requestId = getRequestId();

            conn.on({
                action: 'network/count',
                requestId: requestId,
                status: 'success',
                count: 1
            }, done);

            conn.send({
                action: 'network/count',
                requestId: requestId,
                namePattern: '%ws-network-1%'
            });
        });

        it('should get the first network only', function (done) {
            var requestId = getRequestId();

            var expectedNetwork = {
                name: NETWORK1,
                id: networkId1,
                description: null
            };

            conn.on({
                action: 'network/list',
                requestId: requestId,
                status: 'success',
                networks: [expectedNetwork]
            }, done);

            conn.send({
                action: 'network/list',
                requestId: requestId,
                namePattern: '%ws-network-1%'
            });
        });

        it('should get network count', function (done) {
            var requestId = getRequestId();

            conn.on({
                action: 'network/count',
                requestId: requestId,
                status: 'success'
            }, (err, data) => {
                assert.strictEqual(data.count > 0, true);
                done();
            });

            conn.send({
                action: 'network/count',
                requestId: requestId
            });
        });

        it('should fail with 403 on count all networks', function (done) {
            var requestId = getRequestId();

            noActionsConnection.on({
                code: status.FORBIDDEN
            }, done);

            noActionsConnection.send({
                action: 'network/count',
                requestId: requestId
            });
        });

        it('should get networks in correct ASC order', function (done) {
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

            conn.on({
                action: 'network/list',
                requestId: requestId,
                status: 'success',
                networks: [expectedNetwork1, expectedNetwork2]
            }, done);

            conn.send({
                action: 'network/list',
                requestId: requestId,
                sortField: 'name',
                sortOrder: 'ASC'
            });
        });

        it('should get networks in correct DESC order', function (done) {
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

            conn.on({
                action: 'network/list',
                requestId: requestId,
                status: 'success',
                networks: [expectedNetwork2, expectedNetwork1]
            }, done);

            conn.send({
                action: 'network/list',
                requestId: requestId,
                sortField: 'name',
                sortOrder: 'DESC'
            });
        });


        after(function (done) {
            conn.close();
            noActionsConnection.close();
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
                utils.jwt.create(utils.admin.id, args.actions, args.networkIds, args.deviceTypeIds, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    token = result.accessToken;
                    callback()
                })
            }

            function authenticateConn(callback) {
                conn.on({
                    action: 'authenticate',
                    status: 'success'
                }, callback);

                conn.send({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: token
                });
            }

            async.series([
                createToken,
                createConn,
                authenticateConn
            ], done);
        });

        it('should insert network', function (done) {
            var requestId = getRequestId();

            conn.on({
                action: 'network/insert',
                requestId: requestId,
                status: 'success'
            }, done);

            conn.send({
                action: 'network/insert',
                requestId: requestId,
                network: { name: NETWORK1 }
            });
        });

        after(function (done) {
            conn.close();
            utils.clearDataJWT(done);
        });
    });

    describe('#network/update', function () {

        var conn = null;
        var adminConn = null;

        before(function (done) {
            function createConn(callback) {
                conn = new Websocket(url);
                conn.connect(callback);
            }

            function createAdminConn(callback) {
                adminConn = new Websocket(url);
                adminConn.connect(callback);
            }

            function createToken(callback) {
                var args = {
                    actions: [
                        'GetNetwork',
                        'ManageNetwork'
                    ]
                };
                utils.jwt.create(utils.admin.id, args.actions, args.networkIds, args.deviceTypeIds, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    token = result.accessToken;
                    callback()
                })
            }

            function authenticateConn(callback) {
                conn.on({
                    action: 'authenticate',
                    status: 'success'
                }, callback);

                conn.send({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: token
                });
            }

            function authenticateAdminConn(callback) {
                adminConn.on({
                    action: 'authenticate',
                    status: 'success'
                }, callback);

                adminConn.send({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: utils.jwt.admin
                });
            }

            async.series([
                createToken,
                createConn,
                createAdminConn,
                authenticateConn,
                authenticateAdminConn
            ], done);
        });

        it('should return error for invalid network id with client token', function (done) {
            var requestId = getRequestId();

            conn.on({
                code: 403,
                error: 'Access is denied'
            }, done);

            conn.send({
                action: 'network/update',
                requestId: requestId,
                networkId: utils.NON_EXISTING_ID
            });
        });

        it('should return error for invalid network id with admin token', function (done) {
            var requestId = getRequestId();
            var networkId = utils.NON_EXISTING_ID;

            adminConn.on({
                code: 404,
                error: 'Network with id = ' + networkId + ' not found'
            }, done);
            
            adminConn.send({
                action: 'network/update',
                requestId: requestId,
                networkId: networkId
            });
        });

        it('should update network', function (done) {
            var requestId = getRequestId();

            adminConn.on({
                action: 'network/insert',
                requestId: requestId,
                status: 'success'
            }, networkUpdate);
            
            adminConn.send({
                action: 'network/insert',
                requestId: requestId,
                network: { name: NETWORK1 }
            });

            function networkUpdate(err, result) {
                if (err) {
                    return done(err);
                }

                var requestId = getRequestId();
                this.networkId = result.network.id;
                var NETWORK1_UPDATE = utils.getName('ws-network-1');

                adminConn.on({
                    action: 'network/update',
                    status: 'success',
                    requestId: requestId
                }, checkNetworkUpdate);
                
                adminConn.send({
                    action: 'network/update',
                    requestId: requestId,
                    networkId: this.networkId,
                    network: { name: NETWORK1_UPDATE }
                });
            };

            function checkNetworkUpdate(err, result) {
                if (err) {
                    return done(err);
                }

                var requestId = getRequestId();

                adminConn.on({
                    action: 'network/get',
                    status: 'success',
                    requestId: requestId
                }, done);
                
                adminConn.send({
                    action: 'network/get',
                    requestId: requestId,
                    networkId: this.networkId
                });
            };
        });

        after(function (done) {
            conn.close();
            adminConn.close();
            utils.clearDataJWT(done);
        });
    });

    describe('#network/delete', function () {

        var conn = null;
        var adminConn = null;
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

            function createAdminConn(callback) {
                adminConn = new Websocket(url);
                adminConn.connect(callback);
            }

            function createToken(callback) {
                var args = {
                    actions: [
                        'GetNetwork',
                        'ManageNetwork'
                    ],
                    networkIds: networkId
                };
                utils.jwt.create(utils.admin.id, args.actions, args.networkIds, args.deviceTypeIds, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    token = result.accessToken;
                    callback()
                })
            }

            function authenticateConn(callback) {
                conn.on({
                    action: 'authenticate',
                    status: 'success'
                }, callback);
                
                conn.send({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: token
                });                
            }

            function authenticateAdminConn(callback) {

                adminConn.on({
                    action: 'authenticate',
                    status: 'success'
                }, callback);
                
                adminConn.send({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: utils.jwt.admin
                });
            }

            async.series([
                createNetwork,
                createToken,
                createConn,
                createAdminConn,
                authenticateConn,
                authenticateAdminConn
            ], done);
        });

        it('should return error for invalid network id with client token', function (done) {
            var requestId = getRequestId();

            conn.on({
                code: 403,
                error: 'Access is denied'
            }, done);
            
            conn.send({
                action: 'network/delete',
                requestId: requestId,
                networkId: utils.NON_EXISTING_ID
            });
        });

        it('should return error for invalid network id with admin token', function (done) {
            var requestId = getRequestId();
            var networkId = utils.NON_EXISTING_ID;
            adminConn.on({
                code: 404,
                error: 'Network with id = ' + networkId + ' not found'
            }, done);
            
            adminConn.send({
                action: 'network/delete',
                requestId: requestId,
                networkId: networkId
            });
        });

        it('should delete network', function (done) {

            function deleteNetwork(callback) {
                var requestId = getRequestId();

                conn.on({
                    action: 'network/delete',
                    requestId: requestId,
                    status: 'success'
                }, callback);
                
                conn.send({
                    action: 'network/delete',
                    requestId: requestId,
                    networkId: networkId
                });
            }

            function checkNetwork(callback) {
                req.get(path.NETWORK)
                    .params({ jwt: utils.jwt.admin, id: networkId })
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

