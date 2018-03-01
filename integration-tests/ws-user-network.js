var async = require('async');
var assert = require('assert');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('Websocker API User Network', function () {
    this.timeout(90000);
    var url = null;

    var NETWORK = utils.getName('user-network');
    var deviceId = utils.getName('ws-device-id');
    var networkId = null;
    var userId = null;
    var token = null;
    var conn = null;
    var noTokenConn = null;

    before(function (done) {
        function createUrl(callback) {
            req.get(path.INFO).params({jwt: utils.jwt.admin}).send(function (err, result) {
                if (err) {
                    return callback(err);
                }
                url = result.webSocketServerUrl;
                callback();
            });
        }

        function createUser(callback) {
            utils.createUser2(0, void 0,
                function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    userId = result.user.id;
                    path.current = path.combine(path.USER, userId, path.NETWORK);
                    callback();
                })
        }

        function createNetwork(callback) {
            req.create(path.NETWORK)
                .params({jwt: utils.jwt.admin, data: {name: NETWORK}})
                .send(function (err, result) {
                    if (err) {
                        callback(err);
                    }

                    networkId = result.id;
                    callback();
                });
        }

        function createConn(callback) {
            conn = new Websocket(url);
            conn.connect(callback);
        }

        function createNoTokenConn(callback) {
            noTokenConn = new Websocket(url);
            noTokenConn.connect(callback);
        }

        function createToken(callback) {
            var args = {
                actions: [
                    'ManageUser',
                    'GetCurrentUser',
                    'UpdateCurrentUser',
                    'GetNetwork',
                    'ManageNetwork'
                ],
                deviceIds: deviceId,
                networkIds: void 0,
                deviceTypeIds: void 0
            };
            utils.jwt.create(userId, args.actions, args.networkIds, args.deviceTypeIds, function (err, result) {
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
            createUrl,
            createUser,
            createNetwork,
            createConn,
            createNoTokenConn,
            createToken,
            authenticateConn
        ], done);
    });

    describe('#Update', function () {
        it('should assing user network', function (done) {
            var requestId = getRequestId();
            
            conn.params({
                action: 'user/assignNetwork',
                requestId: requestId,
                userId: userId,
                networkId: networkId
            })
                .send(function (err) {
                    if (err) {
                        return done(err);
                    }

                    conn.params({
                        action: 'user/getNetwork',
                        requestId: requestId,
                        userId: userId,
                        networkId: networkId
                    })
                        .expect({
                            network: {
                                network: {
                                    id: networkId,
                                    name: NETWORK
                                }
                            }
                        })
                        .send(done);
                });
        });
    });

    describe('#Delete', function () {
        it('should delete user network', function (done) {
            var requestId = getRequestId();

            conn.params({
                action: 'user/unassignNetwork',
                requestId: requestId,
                userId: userId,
                networkId: networkId
            })
                .send(function (err) {
                    if (err) {
                        return done(err);
                    }

                    conn.params({
                        action: 'user/getNetwork',
                        requestId: requestId,
                        userId: userId,
                        networkId: networkId
                    })
                        .expectError(status.NOT_FOUND,
                            format('Network with id %s for user with id %s was not found', networkId, userId))
                        .send(done);
                });
        });
    });

    describe('#Unauthorized', function () {

        describe('#No Authorization', function () {
            it('should fail with 401 on authencitation if auth parameters omitted', function (done) {
                var requestId = getRequestId();

                noTokenConn.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: null
                })
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });
            
            it('should fail with 401 when selecting user network by id, auth parameters omitted', function (done) {
                var requestId = getRequestId();

                noTokenConn.params({
                    action: 'user/getNetwork',
                    requestId: getRequestId(),
                    userId: userId,
                    networkId: utils.NON_EXISTING_ID
                })
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when updating user network with no auth parameters', function (done) {
                var requestId = getRequestId();

                noTokenConn.params({
                    action: 'user/assignNetwork',
                    requestId: getRequestId(),
                    userId: userId,
                    networkId: utils.NON_EXISTING_ID
                })
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when deleting user network with no auth parameters', function (done) {
                noTokenConn.params({
                    action: 'user/unassignNetwork',
                    requestId: getRequestId(),
                    userId: userId,
                    networkId: utils.NON_EXISTING_ID
                })
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });
        });

        describe('#Dummy Access Key Authorization', function () {

            var jwt = null;
            var jwtConn = null;
            var refreshConn = null;

            before(function (done) {
                
                function createJWT(callback) {
                    utils.jwt.create(utils.admin.id, 'RegisterDevice', void 0, void 0, function (err, result) {
                        if (err) {
                            return callback(err);
                        }
                        jwt = result.accessToken;
                        callback()
                    })
                }

                function createNonNetworkConn(callback) {
                    jwtConn = new Websocket(url);
                    jwtConn.connect(callback);
                }

                function createRefreshConn(callback) {
                    refreshConn = new Websocket(url);
                    refreshConn.connect(callback);
                }

                function authenticateNonNetworkConn(callback) {
                    jwtConn.params({
                        action: 'authenticate',
                        requestId: getRequestId(),
                        token: jwt
                    })
                        .send(callback);
                }

                async.series([
                    createJWT,
                    createNonNetworkConn,
                    createRefreshConn,
                    authenticateNonNetworkConn
                ], done);
                
            });

            it('should fail with 403 when selecting user network by id using invalid access token', function (done) {
                var requestId = getRequestId();

                jwtConn.params({
                    action: 'user/getNetwork',
                    requestId: getRequestId(),
                    userId: utils.admin.id,
                    networkId: utils.NON_EXISTING_ID
                })
                    .expectError(status.FORBIDDEN, 'Access is denied')
                    .send(done);
            });

            it('should fail with 401 when selecting user network by id using refresh jwt', function (done) {
                var requestId = getRequestId();

                refreshConn.params({
                    action: 'user/getNetwork',
                    requestId: getRequestId(),
                    userId: utils.admin.id,
                    networkId: networkId
                })
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });


            it('should fail with 403 when updating user network using invalid access token', function (done) {
                var requestId = getRequestId();

                jwtConn.params({
                    action: 'user/assignNetwork',
                    requestId: getRequestId(),
                    userId: utils.admin.id,
                    networkId: utils.NON_EXISTING_ID
                })
                    .expectError(status.FORBIDDEN, 'Access is denied')
                    .send(done);
            });

            it('should fail with 403 when deleting user network using invalid access token', function (done) {
                var requestId = getRequestId();

                jwtConn.params({
                    action: 'user/unassignNetwork',
                    requestId: getRequestId(),
                    userId: utils.admin.id,
                    networkId: utils.NON_EXISTING_ID
                })
                    .expectError(status.FORBIDDEN, 'Access is denied')
                    .send(done);
            });

            after(function (done) {
                jwtConn.close();
                refreshConn.close();
                done();
            });
        });
    });

    describe('#Not Found', function () {

        it('should fail with 404 when selecting user network by non-existing id', function (done) {
            var requestId = getRequestId();

            conn.params({
                action: 'user/getNetwork',
                requestId: getRequestId(),
                userId: userId,
                networkId: utils.NON_EXISTING_ID
            })
                .expectError(status.NOT_FOUND,
                    format('Network with id %s for user with id %s was not found', utils.NON_EXISTING_ID, userId))// TODO: swap networkId <> userId in error message
                .send(done);
        });

        it('should fail with 404 when updating user network by non-existing id', function (done) {
            var requestId = getRequestId();

            conn.params({
                action: 'user/assignNetwork',
                requestId: getRequestId(),
                userId: userId,
                networkId: utils.NON_EXISTING_ID
            })
                .expectError(status.NOT_FOUND, format('Network with id = %s not found', utils.NON_EXISTING_ID))
                .send(done);
        });

        it('should succeed when deleting user network by non-existing id', function (done) {
            var requestId = getRequestId();

            conn.params({
                action: 'user/unassignNetwork',
                requestId: getRequestId(),
                userId: userId,
                networkId: utils.NON_EXISTING_ID
            })
                .expectError(status.NOT_FOUND,
                    format('Network with id = %s not found', utils.NON_EXISTING_ID))
                .send(done);
        });

        
    });

    after(function (done) {
        conn.close();
        noTokenConn.close();
        utils.clearDataJWT(done);
    });
});
