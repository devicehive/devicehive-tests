var async = require('async');
var assert = require('assert');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API User', function () {
    this.timeout(90000);
    var url = null;
    var token = null;
    var adminToken = null;
    var user = null;
    var adminUser = null;
    var conn = null;
    var adminConn = null;
    var noTokenConn = null;
    var deviceId = utils.getName('ws-device-id');

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
                networkIds: void 0
            };
            utils.jwt.create(user.id, args.actions, args.networkIds, args.deviceIds, function (err, result) {
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
                networkIds: void 0
            };
            utils.jwt.create(adminUser.id, args.actions, args.networkIds, args.deviceIds, function (err, result) {
                if (err) {
                    return callback(err);
                }
                adminToken = result.accessToken;
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

        function authenticateAdminConn(callback) {
            adminConn.params({
                action: 'authenticate',
                requestId: getRequestId(),
                token: adminToken
            })
                .send(callback);
        }

        async.series([
            createUrl,
            createUser,
            createAdmin,
            createToken,
            createAdminToken,
            createConn,
            createAdminConn,
            createNoTokenConn,
            authenticateConn,
            authenticateAdminConn
        ], done);
    });

    describe('#Get All', function () {
        
        it('should return all users', function (done) {
            var requestId = getRequestId();
            
            conn.params({
                action: 'user/list',
                requestId: requestId
            })
                .expect({
                    action: 'user/list',
                    requestId: requestId,
                    status: 'success'
                })
                .expectTrue(function (result) {
                    return utils.core.isArrayNonEmpty(result.users);
                })
                .expectTrue(function (result) {
                    return result.users.some(function (item) {
                        return item.id === user.id && item.login === user.login;
                    });
                })
                .send(done);
        });

        it('should get user by login', function (done) {
            var requestId = getRequestId();
            
            conn.params({
                action: 'user/list',
                requestId: requestId,
                login: user.login
            })
                .expect({
                    action: 'user/list',
                    requestId: requestId,
                    status: 'success'
                })
                .assert(function (result) {
                    assert.equal(result.users.length === 1, true, "Should get user by login");
                })
                .send(done);
        });

        it('should get non-existing user, no error', function (done) {
            var requestId = getRequestId();
            
            conn.params({
                action: 'user/list',
                requestId: requestId,
                login: 'non-existing'
            })
                .expect({
                    action: 'user/list',
                    requestId: requestId,
                    status: 'success'
                })
                .expectTrue(function (result) {
                    return utils.core.isEmptyArray(result.users);
                })
                .send(done);
        });
    });

    describe('#Get Current', function () {

        it('should authorize using current user', function (done) {
            var requestId = getRequestId();

            conn.params({
                action: 'user/getCurrent',
                requestId: requestId
            })
                .expect({
                    action: 'user/getCurrent',
                    requestId: requestId,
                    status: 'success',
                    current: {
                        id: user.id,
                        login: user.login,
                        role: 1,
                        status: 0
                    }
                })
                .send(done);
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
            
            conn.params({
                action: 'user/get',
                requestId: requestId,
                userId: user.id
            })
                .expect({
                    user: {
                        id: user.id,
                        login: user.login,
                        role: 1,
                        status: 0,
                        lastLogin: null,
                        introReviewed: false
                    }
                })
                .send(done);
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

            conn.params({
                action: 'user/insert',
                requestId: requestId,
                user: userWithInvalidLogin
            })
                .expectError(status.BAD_REQUEST, 'Field cannot be empty. The length of login should be from 3 to 128 symbols.')
                .send(done);
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

            conn.params({
                action: 'user/insert',
                requestId: requestId,
                user: userWithInvalidPassword
            })
                .expectError(status.BAD_REQUEST, 'Password can contain only from 6 to 128 symbols!')
                .send(done);
        });

        it('should get user with reviewed intro by id using admin', function (done) {
            var requestId = getRequestId();
            
            adminConn.params({
                action: 'user/get',
                requestId: requestId,
                userId: reviewedIntroUser.id
            })
                .expect({
                    user: {
                        id: reviewedIntroUser.id,
                            login: reviewedIntroUser.login,
                        role: 0,
                        status: 0,
                        lastLogin: null,
                        introReviewed: true
                    }
                })
                .send(done);
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

            conn.params({
                action: 'user/insert',
                requestId: requestId,
                user: {
                    login: LOGIN,
                    password: utils.NEW_USER_PASSWORD,
                    role: 0,
                    status: 0
                }
            })
                .expectError(status.FORBIDDEN, 'User with such login already exists. Please, select another one')
                .send(done);
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
                    .params({jwt: utils.jwt.admin, data: {name: NETWORK}})
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

            adminConn.params({
                action: 'user/assignNetwork',
                requestId: requestId,
                userId: userWithNetworks.id,
                networkId: networkId
            })
                .send(function (err) {
                    if (err) {
                        return done(err);
                    }
                    var requestId2 = getRequestId();
                    
                    adminConn.params({
                        action: 'user/get',
                        requestId: requestId2,
                        userId: userWithNetworks.id
                    })
                    .expect({
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
                     })
                    .send(done);
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

            conn.params({
                action: 'user/updateCurrent',
                requestId: requestId,
                user: {introReviewed: true}
            })
                .expect({
                    action: "user/updateCurrent",
                    "requestId": requestId,
                    "status": "success"
                })
               .send(function (err) {
                    if (err) {
                        return done(err);
                    }

                   conn.params({
                       action: 'user/getCurrent',
                       requestId: requestId
                   })
                        .expect({
                            "current": {
                                id: user.id,
                                login: user.login,
                                role: 1,
                                status: 0,
                                introReviewed: true
                            }
                        })
                        .send(done);
                });
        });

        it('should update current user data field', function (done) {
            var requestId = getRequestId();
            var requestId2 = getRequestId();
            var requestId3 = getRequestId();

            conn.params({
                action: 'user/updateCurrent',
                requestId: requestId,
                userId: user.id,
                user: {data: "data"}
            })
            .send(function (err) {
                if (err) {
                    return done(err);
                }
                
                conn.params({
                    action: 'user/updateCurrent',
                    requestId: requestId2,
                    userId: user.id,
                    user: {data: null}
                })
                .send(function (err) {
                    if (err) {
                        return done(err);
                    }
                    
                    conn.params({
                        action: 'user/getCurrent',
                        requestId: requestId3,
                        userId: user.id
                    })
                    .expect({
                        current: {
                            id: user.id,
                            login: user.login,
                            status: 0,
                            data: null
                        }
                    })
                    .send(done);
                });
            });
        });

        it('should partially update user account', function (done) {
            var requestId = getRequestId();

            adminConn.params({
                action: 'user/updateCurrent',
                requestId: requestId,
                userId: adminUser.id,
                user: {status: 1}
            })
                .send(function (err) {
                    if (err) {
                        return done(err);
                    }

                    adminConn.params({
                        action: 'user/getCurrent',
                        requestId: requestId,
                        userId: adminUser.id,
                    })
                        .expect({
                            current: {
                                id: adminUser.id,
                                login: adminUser.login,
                                role: 0,
                                status: 1,
                                lastLogin: null,
                                introReviewed: false
                            }
                        })
                        .send(done);
                });
        });


        it('should not be able to update other user if not admin', function (done) {
            var requestId = getRequestId();

            conn.params({
                action: 'user/update',
                requestId: requestId,
                userId: user2.id,
                user: {status: 1}
            })
                .expectError(status.FORBIDDEN, 'Admin permissions required for this action')
                .send(done);
        });

        it('should not be able to update user status if not admin', function (done) {
            var requestId = getRequestId();

            conn.params({
                action: 'user/updateCurrent',
                requestId: requestId,
                user: {status: 1}
            })
                .expectError(status.FORBIDDEN, 'Admin permissions required for this action')
                .send(done);
        });

        it('should not be able to update user role if not admin', function (done) {
            var requestId = getRequestId();

            conn.params({
                action: 'user/updateCurrent',
                requestId: requestId,
                userId: user2.id,
                user: {role: 1}
            })
                .expectError(status.FORBIDDEN, 'Admin permissions required for this action')
                .send(done);
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
            
            conn.params({
                action: 'user/delete',
                requestId: requestId,
                userId: userToDelete.id
            })
                .send(function (err) {
                    if (err) {
                        done(err);
                    }

                    conn.params({
                        action: 'user/get',
                        requestId: requestId,
                        userId: userToDelete.id
                    })
                        .expectError(status.NOT_FOUND, format('User with id = ' + userToDelete.id + ' not found'))
                        .send(done);
                });
        });

        it('should not allow to delete a user that owns current admin jwt with ManageUser permission', function(done){
            var requestId = getRequestId();

            adminConn.params({
                action: 'user/delete',
                requestId: requestId,
                userId: adminUser.id
            })
                .expectError(status.FORBIDDEN, cantDeleteYourselfMessage)
                .send(done);
        });

        it('should not allow to delete a user that owns current client jwt with ManageUser permission', function(done){
            var requestId = getRequestId();
            
            conn.params({
                action: 'user/delete',
                requestId: requestId,
                userId: user.id
            })
                .expectError(status.FORBIDDEN, cantDeleteYourselfMessage)
                .send(done);
            
        });
    });

    describe('#Bad Request', function () {
        
        it('should fail with 400 when trying to create user with invalid parameters', function (done) {
            var requestId = getRequestId();

            conn.params({
                action: 'user/insert',
                requestId: requestId,
                user: {invalidProp: utils.getName('invalid-user')}
            })
                .expectError(status.BAD_REQUEST)
                .send(done);
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

            it('should fail with 401 on user/list if auth parameters omitted', function (done) {
                var requestId = getRequestId();

                noTokenConn.params({
                    action: 'user/list',
                    requestId: getRequestId(),
                    token: null
                })
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when selecting user by id, auth parameters omitted', function (done) {
                var requestId = getRequestId();

                noTokenConn.params({
                    action: 'user/get',
                    requestId: getRequestId(),
                    userId: utils.NON_EXISTING_ID
                })
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when selecting user by \'/current\', auth parameters omitted', function (done) {
                var requestId = getRequestId();

                noTokenConn.params({
                    action: 'user/getCurrent',
                    requestId: getRequestId(),
                    userId: utils.NON_EXISTING_ID
                })
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });


            it('should fail with 401 when creating user with no auth parameters', function (done) {
                var requestId = getRequestId();

                noTokenConn.params({
                    action: 'user/insert',
                    requestId: getRequestId(),
                    user: {login: 'not-authorized'}
                })
                    .expectError(status.NOT_AUTHORIZED)
                    .send(done);
            });

            it('should fail with 401 when updating user with no auth parameters', function (done) {
                var requestId = getRequestId();

                noTokenConn.params({
                    action: 'user/update',
                    requestId: getRequestId(),
                    userId: utils.NON_EXISTING_ID,
                    user: {login: 'not-authorized'}
                })
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when updating user by \'/current\' with no auth parameters', function (done) {
                noTokenConn.params({
                    action: 'user/updateCurrent',
                    requestId: getRequestId(),
                    user: {login: 'not-authorized'}
                })
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when deleting user with no auth parameters', function (done) {
                var requestId = getRequestId();

                noTokenConn.params({
                    action: 'user/delete',
                    requestId: getRequestId(),
                    userId: utils.NON_EXISTING_ID
                })
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
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
                    nonNetworkConn.params({
                        action: 'authenticate',
                        requestId: getRequestId(),
                        token: nonNetworkUserJwt
                    })
                        .send(callback);
                }

                async.series([
                    createUser,
                    createJWT,
                    createNonNetworkConn,
                    createRefreshConn,
                    authenticateNonNetworkConn
                ], done);

            });

            it('should fail with 401 when selecting users with invalid jwt', function (done) {
                var requestId = getRequestId();

                nonNetworkConn.params({
                    action: 'user/list',
                    requestId: getRequestId()
                })
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when selecting user by id with invalid jwt', function (done) {
                var requestId = getRequestId();

                nonNetworkConn.params({
                    action: 'user/get',
                    requestId: getRequestId(),
                    userId: nonNetworkUser.id
                })
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when authenticate with refresh jwt', function (done) {
                var requestId = getRequestId();

                refreshConn.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: utils.jwt.admin_refresh
                })
                    .expectError(status.NOT_AUTHORIZED, 'Invalid credentials')
                    .send(done);
            });

            it('should fail with 401 when selecting users no auth', function (done) {
                var requestId = getRequestId();

                nonNetworkConn.params({
                    action: 'user/list',
                    requestId: getRequestId()
                })
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when getting user with invalid jwt', function (done) {
                var requestId = getRequestId();

                nonNetworkConn.params({
                    action: 'user/list',
                    requestId: getRequestId(),
                    userId: utils.NON_EXISTING_ID
                })
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when creating user with invalid jwt', function (done) {
                var requestId = getRequestId();

                nonNetworkConn.params({
                    action: 'user/insert',
                    requestId: getRequestId(),
                    user: {login: 'not-authorized'}
                })
                    .expectError(status.NOT_AUTHORIZED)
                    .send(done);
            });

            it('should fail with 401 when updating user with invalid jwt', function (done) {
                var requestId = getRequestId();

                nonNetworkConn.params({
                    action: 'user/update',
                    requestId: getRequestId(),
                    userId: utils.NON_EXISTING_ID,
                    user: {login: 'not-authorized'}
                })
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when deleting user with invalid jwt', function (done) {
                var requestId = getRequestId();

                nonNetworkConn.params({
                    action: 'user/delete',
                    requestId: requestId,
                    userId: utils.NON_EXISTING_ID
                })
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
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

            adminConn.params({
                action: 'user/get',
                requestId: getRequestId(),
                userId: utils.NON_EXISTING_ID
            })
                .expectError(status.NOT_FOUND, format('User with id = ' + utils.NON_EXISTING_ID + ' not found'))
                .send(done);
        });

        it('should fail with 404 when updating user by non-existing id', function (done) {
            var requestId = getRequestId();

            adminConn.params({
                action: 'user/update',
                requestId: getRequestId(),
                userId: utils.NON_EXISTING_ID,
                user: {data: 123}
            })
                .expectError(status.NOT_FOUND, format('User with id = ' + utils.NON_EXISTING_ID + ' not found'))
                .send(done);
        });

        it('should fail when deleting user by non-existing id', function (done) {
            var requestId = getRequestId();

            adminConn.params({
                action: 'user/delete',
                requestId: getRequestId(),
                userId: utils.NON_EXISTING_ID
            })
                .expectError(status.NOT_FOUND, format('User with id = ' + utils.NON_EXISTING_ID + ' not found'))
                .send(done);
        });
    });

    after(function (done) {
        adminConn.close();
        noTokenConn.close();
        utils.clearDataJWT(done);
    });
});
