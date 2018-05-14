var async = require('async');
var assert = require('assert');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;
var req = require('./common/request');
var Websocket = require('./common/ws');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API User', function () {
    this.timeout(90000);
    var url = null;
    var token = null;
    var adminToken = null;
    var noActionsToken = null;
    var user = null;
    var adminUser = null;
    var conn = null;
    var adminConn = null;
    var noTokenConn = null;
    var noActionsConnection = null;
    var deviceId = utils.getName('ws-device-id');

    var DEVICE_TYPE1 = utils.getName('ws-device-type-1');
    var DEVICE_TYPE2 = utils.getName('ws-device-type-2');

    before(function (done) {
        function createUrl(callback) {
            req.get(path.INFO).params({ jwt: utils.jwt.admin }).send(function (err, result) {
                if (err) {
                    return callback(err);
                }
                url = result.webSocketServerUrl;
                callback();
            });
        }

        function createUser(callback) {
            utils.createUser2(1, void 0, function (err, result) {
                if (err) {
                    return callback(err);
                }

                user = result.user;
                callback();
            })
        }

        function createAdmin(callback) {
            utils.createUser2(0, void 0, function (err, result) {
                if (err) {
                    return callback(err);
                }

                adminUser = result.user;
                callback();
            })
        }

        function createConn(callback) {
            conn = new Websocket(url);
            conn.connect(callback);
        }

        function createAdminConn(callback) {
            adminConn = new Websocket(url);
            adminConn.connect(callback);
        }

        function createNoTokenConn(callback) {
            noTokenConn = new Websocket(url);
            noTokenConn.connect(callback);
        }

        function createNoActionsConnection(callback) {
            noActionsConnection = new Websocket(url);
            noActionsConnection.connect(callback);
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
            utils.jwt.create(user.id, args.actions, args.networkIds, args.deviceTypeIds, function (err, result) {
                if (err) {
                    return callback(err);
                }
                token = result.accessToken;
                callback()
            })
        }

        function createAdminToken(callback) {
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
            utils.jwt.create(adminUser.id, args.actions, args.networkIds, args.deviceTypeIds, function (err, result) {
                if (err) {
                    return callback(err);
                }
                adminToken = result.accessToken;
                callback()
            })
        }

        function createNoActionsToken(callback) {
            var args = {
                actions: void 0,
                networkIds: void 0,
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

        function authenticateAdminConn(callback) {
            adminConn.on({
                action: 'authenticate',
                status: 'success'
            }, callback);

            adminConn.send({
                action: 'authenticate',
                requestId: getRequestId(),
                token: adminToken
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
            createUrl,
            createUser,
            createAdmin,
            createToken,
            createAdminToken,
            createNoActionsToken,
            createConn,
            createAdminConn,
            createNoTokenConn,
            createNoActionsConnection,
            authenticateConn,
            authenticateAdminConn,
            authenticateNoActionsConnection
        ], done);
    });

    describe('#Get All', function () {

        it('should count all users', function (done) {
            var requestId = getRequestId();

            conn.on({
                action: 'user/count',
                requestId: requestId,
                status: 'success'
            }, (err, data) => {
                assert.strictEqual(data.count > 0, true);
                done();
            });

            conn.send({
                action: 'user/count',
                requestId: requestId
            });
        });

        it('should fail with 403 on count all users', function (done) {
            var requestId = getRequestId();

            noActionsConnection.on({
                code: status.FORBIDDEN
            }, done);

            noActionsConnection.send({
                action: 'user/count',
                requestId: requestId
            });
        });

        it('should return all users', function (done) {
            var requestId = getRequestId();

            conn.on({
                action: 'user/list',
                requestId: requestId,
                status: 'success'
            }, (err, data) => {
                assert(utils.core.isArrayNonEmpty(data.users), 'Array of users should not be empty');
                const checkUsers = data.users.some(item => {
                    return item.id === user.id && item.login === user.login;
                });
                assert(data, 'Array should match user');
                done();
            });

            conn.send({
                action: 'user/list',
                requestId: requestId,
                take: 10000
            });
        });

        it('should count users by login', function (done) {
            var requestId = getRequestId();

            conn.on({
                action: 'user/count',
                requestId: requestId,
                status: 'success',
                count: 1
            }, done);

            conn.send({
                action: 'user/count',
                requestId: requestId,
                login: user.login
            });
        });

        it('should get user by login', function (done) {
            var requestId = getRequestId();

            conn.on({
                action: 'user/list',
                requestId: requestId,
                status: 'success'
            }, (err, data) => {
                assert.equal(data.users.length === 1, true, "Should get user by login");
                done();
            });

            conn.send({
                action: 'user/list',
                requestId: requestId,
                login: user.login,
                take: 10000
            });
        });

        it('should get non-existing user, no error', function (done) {
            var requestId = getRequestId();

            conn.on({
                action: 'user/list',
                requestId: requestId,
                status: 'success'
            }, (err, data) => {
                assert(utils.core.isEmptyArray(data.users), 'Users should be empty');
                done();
            });

            conn.send({
                action: 'user/list',
                requestId: requestId,
                login: 'non-existing',
                take: 10000
            });
        });
    });

    describe('#Get Current', function () {

        it('should authorize using current user', function (done) {
            var requestId = getRequestId();

            conn.on({
                action: 'user/getCurrent',
                requestId: requestId,
                status: 'success',
                current: {
                    id: user.id,
                    login: user.login,
                    role: 1,
                    status: 0
                }
            }, done);

            conn.send({
                action: 'user/getCurrent',
                requestId: requestId
            });
        });
    });

    describe('#Create', function () {
        var reviewedIntroUser = {
            login: utils.getName('intro-usr'),
            password: utils.NEW_USER_PASSWORD
        };

        before(function (done) {
            utils.createReviewedIntroUser(reviewedIntroUser.login, reviewedIntroUser.password, 0, 0,
                function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    reviewedIntroUser.id = result.id;
                    done();
                }
            )
        });

        it('should get user by id', function (done) {
            var requestId = getRequestId();

            conn.on({
                user: {
                    id: user.id,
                    login: user.login,
                    role: 1,
                    status: 0,
                    introReviewed: false
                }
            }, done);

            conn.send({
                action: 'user/get',
                requestId: requestId,
                userId: user.id
            });
        });

        it('should not create user with invalid login', function (done) {
            var requestId = getRequestId();

            var userWithInvalidLogin = {
                "login": "a",
                "role": 0,
                "status": 0,
                "password": "string",
                "oldPassword": "string",
                "data": {
                    "jsonString": "string"
                },
                "introReviewed": false
            };

            conn.on({
                code: status.BAD_REQUEST,
                error: 'Field cannot be empty. The length of login should be from 3 to 128 symbols.'
            }, done);

            conn.send({
                action: 'user/insert',
                requestId: requestId,
                user: userWithInvalidLogin
            });
        });

        it('should not create user with invalid password', function (done) {
            var requestId = getRequestId();

            var userWithInvalidPassword = {
                "login": "aaa",
                "role": 0,
                "status": 0,
                "password": "strin",
                "oldPassword": "strin",
                "data": {
                    "jsonString": "string"
                },
                "introReviewed": false
            };

            conn.on({
                code: status.BAD_REQUEST,
                error: 'Password can contain only from 6 to 128 symbols!'
            }, done);

            conn.send({
                action: 'user/insert',
                requestId: requestId,
                user: userWithInvalidPassword
            });
        });

        it('should get user with reviewed intro by id using admin', function (done) {
            var requestId = getRequestId();

            adminConn.on({
                user: {
                    id: reviewedIntroUser.id,
                    login: reviewedIntroUser.login,
                    role: 0,
                    status: 0,
                    lastLogin: null,
                    introReviewed: true
                }
            }, done);

            adminConn.send({
                action: 'user/get',
                requestId: requestId,
                userId: reviewedIntroUser.id
            });
        });
    });

    describe('#Create Existing', function () {

        var LOGIN = utils.getName('usr-1');
        var existingUser = null;

        before(function (done) {
            utils.createUser(LOGIN, utils.NEW_USER_PASSWORD, 0, 0, function (err, result) {
                if (err) {
                    return done(err);
                }

                existingUser = result.user;
                done();
            })
        });

        it('should fail with 403 when trying to create user with existing login', function (done) {
            var requestId = getRequestId();

            conn.on({
                code: status.FORBIDDEN,
                error: 'User with such login already exists. Please, select another one'
            }, done);

            conn.send({
                action: 'user/insert',
                requestId: requestId,
                user: {
                    login: LOGIN,
                    password: utils.NEW_USER_PASSWORD,
                    role: 0,
                    status: 0
                }
            });
        });
    });

    describe('#Create User Networks', function () {

        var userWithNetworks = {
            login: utils.getName('usr-2'),
            password: utils.NEW_USER_PASSWORD
        };
        var NETWORK = utils.getName('usr-network-2');
        var networkId = null;

        before(function (done) {
            function createUser(callback) {
                utils.createUser(userWithNetworks.login, userWithNetworks.password, 0, 0,
                    function (err, result) {
                        if (err) {
                            return callback(err);
                        }

                        userWithNetworks.id = result.id;
                        callback();
                    })
            }

            function createNetwork(callback) {
                req.create(path.NETWORK)
                    .params({ jwt: utils.jwt.admin, data: { name: NETWORK } })
                    .send(function (err, result) {
                        if (err) {
                            callback(err);
                        }

                        networkId = result.id;
                        callback();
                    });
            }

            async.series([
                createUser,
                createNetwork
            ], done);
        });

        it('should assign user network', function (done) {
            var requestId = getRequestId();

            adminConn.on({
                action: 'user/assignNetwork',
                status: 'success'
            }, (err, data) => {
                if (err) {
                    return done(err);
                }
                var requestId2 = getRequestId();

                adminConn.on({
                    user: {
                        id: userWithNetworks.id,
                        login: userWithNetworks.login,
                        role: 0,
                        status: 0,
                        lastLogin: null,
                        networks: [{
                            id: networkId,
                            name: NETWORK
                        }]
                    }
                }, done);

                adminConn.send({
                    action: 'user/get',
                    requestId: requestId2,
                    userId: userWithNetworks.id
                });
            });

            adminConn.send({
                action: 'user/assignNetwork',
                requestId: requestId,
                userId: userWithNetworks.id,
                networkId: networkId
            });
        });
    });

    describe('#Update Partial', function () {

        var user1 = null;
        var user2 = null;
        var jwt1 = null;
        var jwt2 = null;

        before(function (done) {

            function createUser1(callback) {
                utils.createUser2(1, void 0, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    user1 = result.user;
                    callback();
                })
            }

            function createUser2(callback) {
                utils.createUser2(1, void 0, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    user2 = result.user;
                    callback();
                })
            }

            function createJWT1(callback) {
                utils.jwt.create(user1.id, ['GetCurrentUser', 'UpdateCurrentUser'], void 0, void 0, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    jwt1 = result.accessToken;
                    callback()
                })
            }

            function createJWT2(callback) {
                utils.jwt.create(user2.id, ['GetCurrentUser', 'UpdateCurrentUser'], void 0, void 0, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    jwt2 = result.accessToken;
                    callback()
                })
            }

            async.series([
                createUser1,
                createUser2,
                createJWT1,
                createJWT2
            ], done);
        });

        it('should update current user introReviewed field', function (done) {
            var requestId = getRequestId();

            conn.on({
                action: "user/updateCurrent",
                requestId: requestId,
                status: "success"
            }, (err, data) => {
                if (err) {
                    return done(err);
                }
                var requestId2 = getRequestId();

                conn.on({
                    current: {
                        id: user.id,
                        login: user.login,
                        role: 1,
                        status: 0,
                        introReviewed: true
                    }
                }, done);

                conn.send({
                    action: 'user/getCurrent',
                    requestId: requestId
                });
            });

            conn.send({
                action: 'user/updateCurrent',
                requestId: requestId,
                user: { introReviewed: true }
            });
        });

        it('should update current user data field', function (done) {
            var requestId = getRequestId();
            var requestId2 = getRequestId();
            var requestId3 = getRequestId();

            conn.on({
                action: "user/updateCurrent",
                requestId: requestId,
                status: "success"
            }, (err, data) => {
                if (err) {
                    return done(err);
                }
                var requestId2 = getRequestId();

                conn.on({
                    action: "user/updateCurrent",
                    requestId: requestId2,
                    status: "success"
                }, (err, data) => {
                    if (err) {
                        done(err);
                    }
                    conn.on({
                        current: {
                            id: user.id,
                            login: user.login,
                            status: 0,
                            data: null
                        }
                    }, done);
                    conn.send({
                        action: 'user/getCurrent',
                        requestId: requestId3,
                        userId: user.id
                    });
                });

                conn.send({
                    action: 'user/updateCurrent',
                    requestId: requestId2,
                    userId: user.id,
                    user: { data: null }
                });
            });

            conn.send({
                action: 'user/updateCurrent',
                requestId: requestId,
                userId: user.id,
                user: { data: { userdata: "userdata" } }
            });
        });

        it('should update current user password field', function (done) {
            var requestId = getRequestId();
            var requestId2 = getRequestId();

            conn.on({
                action: "user/updateCurrent",
                requestId: requestId,
                status: "success"
            }, (err, data) => {
                if (err) {
                    return done(err);
                }
                var requestId2 = getRequestId();

                conn.on({
                    current: {
                        id: user.id,
                        login: user.login,
                        status: 0,
                        data: null
                    }
                }, done);

                conn.send({
                    action: 'user/getCurrent',
                    requestId: requestId2,
                    userId: user.id
                });
            });

            conn.send({
                action: 'user/updateCurrent',
                requestId: requestId,
                userId: user.id,
                user: { password: "devicehive" }
            });
        });

        it('should partially update user account', function (done) {
            var requestId = getRequestId();

            adminConn.on({
                action: "user/update",
                status: "success"
            }, (err, data) => {
                if (err) {
                    return done(err);
                }
                var requestId2 = getRequestId();

                adminConn.on({
                    user: {
                        id: user.id,
                        login: user.login,
                        role: 1,
                        status: 1,
                        introReviewed: true
                    }
                }, done);

                adminConn.send({
                    action: 'user/get',
                    requestId: requestId,
                    userId: user.id
                });
            });

            adminConn.send({
                action: 'user/update',
                requestId: requestId,
                userId: user.id,
                user: { status: 1 }
            });
        });

        it('should not be able to update other user if not admin', function (done) {
            var requestId = getRequestId();
            conn.on({
                code: status.FORBIDDEN,
                error: 'Admin permissions required for this action'
            }, done);

            conn.send({
                action: 'user/update',
                requestId: requestId,
                userId: user2.id,
                user: { status: 1 }
            });
        });

        it('should not be able to update user status if not admin', function (done) {
            var requestId = getRequestId();

            conn.on({
                code: status.FORBIDDEN,
                error: 'Admin permissions required for this action'
            }, done);

            conn.send({
                action: 'user/updateCurrent',
                requestId: requestId,
                user: { status: 1 }
            });
        });

        it('should not be able to update user role if not admin', function (done) {
            var requestId = getRequestId();

            conn.on({
                code: status.FORBIDDEN,
                error: 'Admin permissions required for this action'
            }, done);

            conn.send({
                action: 'user/updateCurrent',
                requestId: requestId,
                userId: user2.id,
                user: { role: 1 }
            });
        });
    });

    describe('#Delete', function () {
        var cantDeleteYourselfMessage = "You can not delete a user or access key that you use to authenticate this request";

        var userToDelete = null;

        before(function (done) {
            utils.createUser2(0, void 0, function (err, result) {
                if (err) {
                    return done(err);
                }

                userToDelete = result.user;
                done();
            })
        });

        it('should fail with 404 when trying to get deleted user', function (done) {
            var requestId = getRequestId();

            conn.on({
                action: "user/delete",
                status: "success"
            }, (err, data) => {
                if (err) {
                    return done(err);
                }
                var requestId2 = getRequestId();

                conn.on({
                    code: status.NOT_FOUND,
                    error: 'User with id = ' + userToDelete.id + ' not found'
                }, done);

                conn.send({
                    action: 'user/get',
                    requestId: requestId,
                    userId: userToDelete.id
                });
            });

            conn.send({
                action: 'user/delete',
                requestId: requestId,
                userId: userToDelete.id
            });
        });

        it('should not allow to delete a user that owns current admin jwt with ManageUser permission', function (done) {
            var requestId = getRequestId();

            adminConn.on({
                code: status.FORBIDDEN,
                error: cantDeleteYourselfMessage
            }, done);

            adminConn.send({
                action: 'user/delete',
                requestId: requestId,
                userId: adminUser.id
            });
        });

        it('should not allow to delete a user that owns current client jwt with ManageUser permission', function (done) {
            var requestId = getRequestId();

            conn.on({
                code: status.FORBIDDEN,
                error: cantDeleteYourselfMessage
            }, done);

            conn.send({
                action: 'user/delete',
                requestId: requestId,
                userId: user.id
            });
        });
    });

    describe('#Bad Request', function () {

        it('should fail with 400 when trying to create user with invalid parameters', function (done) {
            var requestId = getRequestId();

            conn.on({
                code: status.BAD_REQUEST
            }, done);

            conn.send({
                action: 'user/insert',
                requestId: requestId,
                user: { invalidProp: utils.getName('invalid-user') }
            });
        });
    });

    describe('#Unauthorized', function () {

        describe('#No Authorization', function () {
            it('should fail with 401 on authencitation if auth parameters omitted', function (done) {
                var requestId = getRequestId();

                noTokenConn.on({
                    code: status.NOT_AUTHORIZED,
                    error: 'Unauthorized'
                }, done);
    
                noTokenConn.send({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: null
                });
            });

            it('should fail with 401 on user/list if auth parameters omitted', function (done) {
                var requestId = getRequestId();

                noTokenConn.on({
                    code: status.NOT_AUTHORIZED,
                    error: 'Unauthorized'
                }, done);
    
                noTokenConn.send({
                    action: 'user/list',
                    requestId: getRequestId(),
                    token: null
                });
            });

            it('should fail with 401 when selecting user by id, auth parameters omitted', function (done) {
                var requestId = getRequestId();

                noTokenConn.on({
                    code: status.NOT_AUTHORIZED,
                    error: 'Unauthorized'
                }, done);
    
                noTokenConn.send({
                    action: 'user/get',
                    requestId: getRequestId(),
                    userId: utils.NON_EXISTING_ID
                });
            });

            it('should fail with 401 when selecting user by \'/current\', auth parameters omitted', function (done) {
                var requestId = getRequestId();

                noTokenConn.on({
                    code: status.NOT_AUTHORIZED,
                    error: 'Unauthorized'
                }, done);
    
                noTokenConn.send({
                    action: 'user/getCurrent',
                    requestId: getRequestId(),
                    userId: utils.NON_EXISTING_ID
                });
            });

            it('should fail with 401 when creating user with no auth parameters', function (done) {
                var requestId = getRequestId();

                noTokenConn.on({
                    code: status.NOT_AUTHORIZED,
                    error: 'Unauthorized'
                }, done);
    
                noTokenConn.send({
                    action: 'user/insert',
                    requestId: getRequestId(),
                    user: { login: 'not-authorized' }
                });
            });

            it('should fail with 401 when updating user with no auth parameters', function (done) {
                var requestId = getRequestId();

                noTokenConn.on({
                    code: status.NOT_AUTHORIZED,
                    error: 'Unauthorized'
                }, done);
    
                noTokenConn.send({
                    action: 'user/update',
                    requestId: getRequestId(),
                    userId: utils.NON_EXISTING_ID,
                    user: { login: 'not-authorized' }
                });
            });

            it('should fail with 401 when updating user by \'/current\' with no auth parameters', function (done) {

                noTokenConn.on({
                    code: status.NOT_AUTHORIZED,
                    error: 'Unauthorized'
                }, done);
    
                noTokenConn.send({
                    action: 'user/updateCurrent',
                    requestId: getRequestId(),
                    user: { login: 'not-authorized' }
                });
            });

            it('should fail with 401 when deleting user with no auth parameters', function (done) {
                var requestId = getRequestId();

                noTokenConn.on({
                    code: status.NOT_AUTHORIZED,
                    error: 'Unauthorized'
                }, done);
    
                noTokenConn.send({
                    action: 'user/delete',
                    requestId: getRequestId(),
                    userId: utils.NON_EXISTING_ID
                });
            });
        });

        describe('#User Authorization', function () {
            var nonNetworkUser = null;
            var nonNetworkUserJwt = null;
            var nonNetworkConn = null;
            var refreshConn = null;

            before(function (done) {

                function createUser(callback) {
                    utils.createUser2(1, void 0, function (err, result) {
                        if (err) {
                            return callback(err);
                        }

                        nonNetworkUser = result.user;
                        callback();
                    });
                }

                function createJWT(callback) {
                    utils.jwt.create(nonNetworkUser.id, void 0, void 0, void 0, function (err, result) {
                        if (err) {
                            return callback(err);
                        }
                        nonNetworkUserJwt = result.accessToken;
                        callback()
                    })
                }

                function createNonNetworkConn(callback) {
                    nonNetworkConn = new Websocket(url);
                    nonNetworkConn.connect(callback);
                }

                function createRefreshConn(callback) {
                    refreshConn = new Websocket(url);
                    refreshConn.connect(callback);
                }


                function authenticateNonNetworkConn(callback) {
                    nonNetworkConn.on({
                        action: 'authenticate',
                        status: 'success'
                    }, callback);
        
                    nonNetworkConn.send({
                        action: 'authenticate',
                        requestId: getRequestId(),
                        token: nonNetworkUserJwt
                    });
                }

                async.series([
                    createUser,
                    createJWT,
                    createNonNetworkConn,
                    createRefreshConn,
                    authenticateNonNetworkConn
                ], done);

            });

            it('should fail with 403 when selecting users with invalid jwt', function (done) {
                var requestId = getRequestId();

                nonNetworkConn.on({
                    code: status.FORBIDDEN,
                    error: 'Access is denied'
                }, done);
    
                nonNetworkConn.send({
                    action: 'user/list',
                    requestId: getRequestId()
                });
            });

            it('should fail with 403 when selecting user by id with invalid jwt', function (done) {
                var requestId = getRequestId();

                nonNetworkConn.on({
                    code: status.FORBIDDEN,
                    error: 'Access is denied'
                }, done);
    
                nonNetworkConn.send({
                    action: 'user/get',
                    requestId: getRequestId(),
                    userId: nonNetworkUser.id
                });
            });

            it('should fail with 401 when authenticate with refresh jwt', function (done) {
                var requestId = getRequestId();

                refreshConn.on({
                    code: status.NOT_AUTHORIZED,
                    error: 'Invalid credentials'
                }, done);
    
                refreshConn.send({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: utils.jwt.admin_refresh
                });
            });

            it('should fail with 403 when selecting users no auth', function (done) {
                var requestId = getRequestId();

                nonNetworkConn.on({
                    code: status.FORBIDDEN,
                    error: 'Access is denied'
                }, done);
    
                nonNetworkConn.send({
                    action: 'user/list',
                    requestId: getRequestId()
                });
            });

            it('should fail with 403 when getting user with invalid jwt', function (done) {
                var requestId = getRequestId();

                nonNetworkConn.on({
                    code: status.FORBIDDEN,
                    error: 'Access is denied'
                }, done);
    
                nonNetworkConn.send({
                    action: 'user/list',
                    requestId: getRequestId(),
                    userId: utils.NON_EXISTING_ID
                });
            });

            it('should fail with 403 when creating user with invalid jwt', function (done) {
                var requestId = getRequestId();

                nonNetworkConn.on({
                    code: status.FORBIDDEN,
                    error: 'Access is denied'
                }, done);
    
                nonNetworkConn.send({
                    action: 'user/insert',
                    requestId: getRequestId(),
                    user: { login: 'not-authorized' }
                });
            });

            it('should fail with 403 when updating user with invalid jwt', function (done) {
                var requestId = getRequestId();

                nonNetworkConn.on({
                    code: status.FORBIDDEN,
                    error: 'Access is denied'
                }, done);
    
                nonNetworkConn.send({
                    action: 'user/update',
                    requestId: getRequestId(),
                    userId: utils.NON_EXISTING_ID,
                    user: { login: 'not-authorized' }
                });
            });

            it('should fail with 403 when deleting user with invalid jwt', function (done) {
                var requestId = getRequestId();

                nonNetworkConn.on({
                    code: status.FORBIDDEN,
                    error: 'Access is denied'
                }, done);
    
                nonNetworkConn.send({
                    action: 'user/delete',
                    requestId: requestId,
                    userId: utils.NON_EXISTING_ID
                });
            });

            after(function (done) {
                nonNetworkConn.close();
                refreshConn.close();
                done();
            });
        });
    });

    describe('#Not Found', function () {

        it('should fail with 404 when selecting user by non-existing id', function (done) {
            var requestId = getRequestId();

            adminConn.on({
                code: status.NOT_FOUND,
                error: 'User with id = ' + utils.NON_EXISTING_ID + ' not found'
            }, done);

            adminConn.send({
                action: 'user/get',
                requestId: getRequestId(),
                userId: utils.NON_EXISTING_ID
            });
        });

        it('should fail with 404 when updating user by non-existing id', function (done) {
            var requestId = getRequestId();

            adminConn.on({
                code: status.NOT_FOUND,
                error: 'User with id = ' + utils.NON_EXISTING_ID + ' not found'
            }, done);

            adminConn.send({
                action: 'user/update',
                requestId: getRequestId(),
                userId: utils.NON_EXISTING_ID,
                user: { data: { userdata: 123 } }
            });
        });

        it('should fail when deleting user by non-existing id', function (done) {
            var requestId = getRequestId();

            adminConn.on({
                code: status.NOT_FOUND,
                error: 'User with id = ' + utils.NON_EXISTING_ID + ' not found'
            }, done);

            adminConn.send({
                action: 'user/delete',
                requestId: getRequestId(),
                userId: utils.NON_EXISTING_ID
            });
        });
    });

    describe('#Last Login', function () {

        it('should set last login on authentication', function (done) {
            var user = {
                login: utils.getName('usr-1'),
                password: utils.NEW_USER_PASSWORD
            };
            var params = { jwt: utils.jwt.admin };

            utils.createUser(user.login, user.password, 0, 0,
                function (err, result) {
                    if (err) {
                        return done(err);
                    }
                    user.id = result.id;
                });

            setTimeout(function createToken(callback) {
                var args = {
                    actions: [
                        'GetDeviceNotification',
                        'GetDeviceCommand',
                        'CreateDeviceNotification',
                        'CreateDeviceCommand',
                        'UpdateDeviceCommand'
                    ],
                    networkIds: void 0,
                    deviceId: void 0
                };
                utils.jwt.create(user.id, args.actions, args.networkIds, args.deviceId, function (err, result) {
                    if (err) {
                        return done(err);
                    }
                    user.accessToken = result.accessToken;
                })
            }, 100);

            setTimeout(function authenticateConn(callback) {
                conn.on({
                    action: 'authenticate',
                    status: 'success'
                }, callback);
    
                conn.send({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: user.accessToken
                });
            }, 200);

            setTimeout(function () {
                adminConn.on({
                    action: 'user/get',
                    status: 'success'
                }, (err,data) => {
                    assert(data.user.lastLogin !== null);
                    done();
                });
    
                adminConn.send({
                    action: 'user/get',
                    userId: user.id
                });
            }, 300);
        });
    });

    describe('#user/getDeviceTypes', function () {
        var conn = null;
        var deviceTypeId1 = null;
        var deviceTypeId2 = null;
        var userId1 = null;
        var userId2 = null;
        var userId3 = null;

        before(function (done) {
            function createDeviceType1(callback) {
                var params = {
                    jwt: utils.jwt.admin,
                    data: { name: DEVICE_TYPE1 }
                };

                utils.create(path.DEVICE_TYPE, params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    deviceTypeId1 = result.id;
                    callback();
                });
            }

            function createDeviceType2(callback) {
                var params = {
                    jwt: utils.jwt.admin,
                    data: { name: DEVICE_TYPE2 }
                };

                utils.create(path.DEVICE_TYPE, params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    deviceTypeId2 = result.id;
                    callback();
                });
            }

            function createUser1(callback) {
                utils.createUser(utils.getName("current_admin_user"), utils.NEW_USER_PASSWORD, 0, 0, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    userId1 = result.id;
                    callback();
                })
            }

            function createUser2(callback) {
                utils.createUser4(1, deviceTypeId2, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    userId2 = result.user.id;
                    callback();
                });
            }

            function createUser3(callback) {
                utils.createAllDTAvailableUser(utils.getName("current_admin_user"), utils.NEW_USER_PASSWORD, 0, 0, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    userId3 = result.id;
                    callback();
                })
            }

            function createConn(callback) {
                conn = new Websocket(url);
                conn.connect(callback);
            }

            function createToken(callback) {
                var args = {
                    actions: [
                        'GetDeviceType',
                        'ManageDeviceType',
                        'ManageUser'
                    ],
                    deviceTypeIds: [deviceTypeId1, deviceTypeId2]
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
                createDeviceType1,
                createDeviceType2,
                createUser1,
                createUser2,
                createUser3,
                createToken,
                createConn,
                authenticateConn
            ], done);
        });

        it('should not get any device types for user created with allDeviceTypesAvailable = false', function (done) {
            var requestId = getRequestId();

            conn.on({
                action: 'user/getDeviceTypes',
                requestId: requestId,
                status: 'success',
                deviceTypes: []
            }, done);

            conn.send({
                action: 'user/getDeviceTypes',
                userId: userId1,
                requestId: requestId
            });
        });

        it('should get only available device types for user', function (done) {
            var requestId = getRequestId();

            var expectedDeviceType2 = {
                name: DEVICE_TYPE2,
                id: deviceTypeId2,
                description: null
            };

            conn.on({
                action: 'user/getDeviceTypes',
                requestId: requestId,
                status: 'success',
                deviceTypes: [expectedDeviceType2]
            }, done);

            conn.send({
                action: 'user/getDeviceTypes',
                userId: userId2,
                requestId: requestId
            });
        });

        it('should get all available device types for user created with default allDeviceTypesAvailable', function (done) {
            var requestId = getRequestId();

            conn.on({
                action: 'user/getDeviceTypes',
                status: 'success'
            }, (err,data) => {
                assert(data.deviceTypes.length > 2, 'Length of deviceTypes should be bigger than 2');
                done();
            });

            conn.send({
                action: 'user/getDeviceTypes',
                userId: userId3,
                requestId: requestId
            });
        });

        it('should return error for invalid user id', function (done) {
            var requestId = getRequestId();

            conn.on({
                code: 400,
                error: 'User id is wrong or empty'
            }, done);

            conn.send({
                action: 'user/getDeviceTypes',
                requestId: requestId,
                deviceTypeId: utils.NON_EXISTING_ID
            });
        });

        after(function (done) {
            conn.close();
            utils.clearDataJWT(done);
        });
    });

    after(function (done) {
        adminConn.close();
        noTokenConn.close();
        noActionsConnection.close();
        utils.clearDataJWT(done);
    });
});
