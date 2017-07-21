var async = require('async');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;
var req = require('./common/request');

describe('REST API User', function () {
    this.timeout(90000);

    before(function () {
        path.current = path.USER;
    });

    describe('#Get All', function () {
        var user = null;

        before(function (done) {
            utils.createUser2(1, void 0, function (err, result) {
                if (err) {
                    return done(err);
                }

                user = result.user;
                done();
            })
        });

        it('should return all users when using admin credentials', function (done) {
            req.get(path.current)
                .params({jwt: utils.jwt.admin})
                .expectTrue(function (result) {
                    return utils.core.isArrayNonEmpty(result);
                })
                .expectTrue(function (result) {
                    return result.some(function (item) {
                        return item.id === user.id && item.login === user.login;
                    });
                })
                .send(done);
        });

        it('should get user by login', function (done) {
            req.get(path.current)
                .params({jwt: utils.jwt.admin})
                .query('login', user.login)
                .expect([{
                    id: user.id,
                    login: user.login
                }])
                .send(done);
        });

        it('should get non-existing user, no error', function (done) {
            req.get(path.current)
                .params({jwt: utils.jwt.admin})
                .query('login', 'non-existing')
                .expectTrue(function (result) {
                    return utils.core.isEmptyArray(result);
                })
                .send(done);
        });
    });

    describe('#Get Current', function () {

        var user = null;
        var jwt = null;

        before(function (done) {

            function createUser(callback) {
                utils.createUser2(1, void 0, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    user = result.user;
                    callback();
                })
            }

            function createJWT(callback) {
                utils.jwt.create(user.id, 'GetCurrentUser', void 0, void 0, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    jwt = result.accessToken;
                    callback()
                })
            }

            async.series([
                createUser,
                createJWT
            ], done);

        });

        it('should authorize using current user', function (done) {
            req.get(path.combine(path.USER, path.CURRENT))
                .params({jwt: jwt})
                .expect({
                    id: user.id,
                    login: user.login,
                    role: 1,
                    status: 0
                })
                .send(done);
        });
    });

    describe('#Create', function () {

        var user = null;
        var reviewedIntroUser = {
            login: utils.getName('intro-usr'),
            password: utils.NEW_USER_PASSWORD
        };

        before(function (done) {
            function createUser(callback) {
                utils.createUser2(0, void 0, function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    user = result.user;
                    callback();
                })
            }

            function createReviewedIntroUser(callback) {
                utils.createReviewedIntroUser(reviewedIntroUser.login, reviewedIntroUser.password, 0, 0,
                    function (err, result) {
                        if (err) {
                            return callback(err);
                        }

                        reviewedIntroUser.id = result.id;
                        callback();
                    })
            }

            async.series([
                createUser,
                createReviewedIntroUser
            ], done);
        });

        it('should get user by id using admin', function (done) {
            req.get(path.current)
                .params({jwt: utils.jwt.admin, id: user.id})
                .expect({
                    id: user.id,
                    login: user.login,
                    role: 0,
                    status: 0,
                    lastLogin: null,
                    introReviewed: false
                })
                .send(done);
        });

        it('should not create user with invalid login', function (done) {
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

            req.create(path.current)
                .params({jwt: utils.jwt.admin, data: userWithInvalidLogin})
                .expectError(status.BAD_REQUEST, 'Field cannot be empty. The length of login should be from 3 to 128 symbols.')
                .send(done);
        });

        it('should not create user with invalid password', function (done) {
            var userWithInvalidLogin = {
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

            req.create(path.current)
                .params({jwt: utils.jwt.admin, data: userWithInvalidLogin})
                .expectError(status.BAD_REQUEST, 'Password can contain only from 6 to 128 symbols!')
                .send(done);
        });

        it('should get user with reviewed intro by id using admin', function (done) {
            req.get(path.current)
                .params({jwt: utils.jwt.admin, id: reviewedIntroUser.id})
                .expect({
                    id: reviewedIntroUser.id,
                    login: reviewedIntroUser.login,
                    role: 0,
                    status: 0,
                    lastLogin: null,
                    introReviewed: true
                })
                .send(done);
        });
    });

    describe('#Create Existing', function () {

        var LOGIN = utils.getName('usr-1');

        before(function (done) {
            req.create(path.current)
                .params({
                    jwt: utils.jwt.admin,
                    data: {
                        login: LOGIN,
                        password: utils.NEW_USER_PASSWORD,
                        role: 0,
                        status: 0 }
                })
                .send(done);
        });

        it('should fail with 403 when trying to create user with existing login', function (done) {
            req.create(path.current)
                .params({
                    jwt: utils.jwt.admin,
                    data: {
                        login: LOGIN,
                        password: utils.NEW_USER_PASSWORD,
                        role: 0,
                        status: 0 }
                })
                .expectError(status.FORBIDDEN, 'User with such login already exists. Please, select another one')
                .send(done);
        });
    });

    describe('#Create User Networks', function () {

        var user = {
            login: utils.getName('usr-2'),
            password: utils.NEW_USER_PASSWORD
        };
        var NETWORK = utils.getName('usr-network-2');
        var networkId = null;

        before(function (done) {
            function createUser(callback) {
                utils.createUser(user.login, user.password, 0, 0,
                    function (err, result) {
                        if (err) {
                            return callback(err);
                        }

                        user.id = result.id;
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

        it('should create user network', function (done) {
            req.update(path.combine(path.USER, user.id, path.NETWORK, networkId))
                .params({jwt: utils.jwt.admin})
                .send(function (err) {
                    if (err) {
                        return done(err);
                    }

                    req.get(path.current)
                        .params({jwt: utils.jwt.admin, id: user.id})
                        .expect({
                            id: user.id,
                            login: user.login,
                            role: 0,
                            status: 0,
                            lastLogin: null,
                            networks: [{
                                    id: networkId,
                                    name: NETWORK
                            }]
                        })
                        .send(done);
                });
        });
    });

    describe('#Update Partial', function () {

        var user = null;
        var user2 = null;
        var user3 = null;
        var jwt = null;
        var jwt2 = null;

        before(function (done) {
            function createUser(callback) {
                utils.createUser2(1, void 0, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    user = result.user;
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

            function createUser3(callback) {
                utils.createUser2(1, void 0, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    user3 = result.user;
                    callback();
                })
            }

            function createJWT(callback) {
                utils.jwt.create(user.id, ['GetCurrentUser', 'UpdateCurrentUser'], void 0, void 0, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    jwt = result.accessToken;
                    callback()
                })
            }

            function createJWT2(callback) {
                utils.jwt.create(user3.id, ['GetCurrentUser', 'UpdateCurrentUser'], void 0, void 0, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    jwt2 = result.accessToken;
                    callback()
                })
            }

            async.series([
                createUser,
                createUser2,
                createUser3,
                createJWT,
                createJWT2
            ], done);
        });

        it('should update current user introReviewed field', function (done) {
            req.update(path.combine(path.USER, path.CURRENT))
                .params({jwt: jwt, data: {introReviewed: true}})
                .send(function (err) {
                    if (err) {
                        return done(err);
                    }

                    req.get(path.combine(path.USER, path.CURRENT))
                        .params({jwt: jwt})
                        .expect({
                            id: user.id,
                            login: user.login,
                            role: 1,
                            status: 0,
                            introReviewed: true
                        })
                        .send(done);
                });
        });

        it('should update current user data field', function (done) {
            req.update(path.combine(path.USER, path.CURRENT))
                .params({jwt: jwt, data: {data: "data"}})
                .send(function (err) {
                    if (err) {
                        return done(err);
                    }

                    req.update(path.combine(path.USER, path.CURRENT))
                        .params({jwt: jwt, data: {data: null}})
                        .send(function (err) {
                            if (err) {
                                return done(err);
                            }

                            req.get(path.combine(path.USER, path.CURRENT))
                                .params({jwt: jwt})
                                .expect({
                                    id: user.id,
                                    login: user.login,
                                    role: 1,
                                    status: 0,
                                    data: null
                                })
                                .send(done);
                        });
                });
        });

        it('should partially update user account', function (done) {
            req.update(path.current)
                .params({jwt: utils.jwt.admin, id: user.id, data: {status: 1}})
                .send(function (err) {
                    if (err) {
                        return done(err);
                    }

                    req.get(path.current)
                        .params({jwt: utils.jwt.admin, id: user.id})
                        .expect({
                            id: user.id,
                            login: user.login,
                            role: 1,
                            status: 1,
                            lastLogin: null,
                            introReviewed: true
                        })
                        .send(done);
                });
        });


        it('should not be able to update other user if not admin', function (done) {
            req.update(path.current)
                .params({jwt: jwt, id: user2.id, data: {status: 1}})
                .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                .send(done);
        });

        it('should not be able to update user status if not admin', function (done) {
            req.update(path.combine(path.USER, path.CURRENT))
                .params({jwt: jwt2, data: {status: 1}})
                .expectError(status.FORBIDDEN, 'Admin permissions required for this action')
                .send(done);
        });

        it('should not be able to update user role if not admin', function (done) {
            req.update(path.combine(path.USER, path.CURRENT))
                .params({jwt: jwt2, data: {role: 1}})
                .expectError(status.FORBIDDEN, 'Admin permissions required for this action')
                .send(done);
        });

    });

    describe('#Delete', function () {
        var cantDeleteYourselfMessage = "You can not delete a user or access key that you use to authenticate this request";

        var user = null;

        before(function (done) {
            utils.createUser2(0, void 0, function (err, result) {
                if (err) {
                    return done(err);
                }

                user = result.user;
                done();
            })
        });

        it('should fail with 404 when trying to get deleted user', function (done) {
            req.delete(path.current)
                .params({jwt: utils.jwt.admin, id: user.id})
                .send(function (err) {
                    if (err) {
                        done(err);
                    }

                    req.get(path.current)
                        .params({jwt: utils.jwt.admin, id: user.id})
                        .expectError(status.NOT_FOUND, format('User with id = ' + user.id + ' not found'))
                        .send(done);
                });
        });

        it('should not allow to delete a user that owns current admin jwt with ManageUser permission', function(done){
            var newUserAdmin = {login: utils.getName("current_admin_user"), password: utils.NEW_USER_PASSWORD};
            utils.createUser(newUserAdmin.login, newUserAdmin.password, 0, 0, function(err, user){
                if(err){
                    done(err);
                }
                utils.jwt.create(user.id, 'ManageUser', void 0, void 0, function(err, jwt){
                    if(err){
                        done(err);
                    }
                    req.delete(path.current)
                        .params({jwt: jwt.accessToken, id: user.id})
                        .expectError(status.FORBIDDEN, cantDeleteYourselfMessage)
                        .send(done);
                });
            });
        });

        it('should not allow to delete a user that owns current client jwt with ManageUser permission', function(done){
            var newClientUser = {login: utils.getName("current_client_user"), password: utils.NEW_USER_PASSWORD};
            utils.createUser(newClientUser.login, newClientUser.password, 1, 0, function(err, user){
                if(err){
                    done(err);
                }
                utils.jwt.create(user.id,  void 0, void 0, void 0, function(err, jwt){
                    if(err){
                        done(err);
                    }
                    req.delete(path.current)
                        .params({jwt: jwt.accessToken, id: user.id})
                        .expectError(status.NOT_AUTHORIZED, "Unauthorized")
                        .send(done);
                });
            });
        });
    });

    describe('#Bad Request', function () {
        it('should fail with 400 when trying to create user with invalid parameters', function (done) {
            req.create(path.current)
                .params({jwt: utils.jwt.admin, data: {invalidProp: utils.getName('invalid-user')}})
                .expectError(status.BAD_REQUEST)
                .send(done);
        });
    });

    // Some of tests could be pending due to allowing anonymous user creation in java-server configuration
    describe('#Unauthorized', function () {

        describe('#No Authorization', function () {
            it('should fail with 401 if auth parameters omitted', function (done) {
                req.get(path.current)
                    .params({jwt: null})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when selecting user by id, auth parameters omitted', function (done) {
                req.get(path.current)
                    .params({jwt: null, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when selecting user by \'/current\', auth parameters omitted', function (done) {
                req.get(path.combine(path.current, path.CURRENT))
                    .params({jwt: null})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });


            it('should fail with 401 when creating user with no auth parameters', function (done) {
                req.create(path.current)
                    .params({jwt: null, data: {login: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED)
                    .send(done);
            });

            it('should fail with 401 when updating user with no auth parameters', function (done) {
                req.update(path.current)
                    .params({jwt: null, id: utils.NON_EXISTING_ID, data: {login: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when updating user by \'/current\' with no auth parameters', function (done) {
                req.update(path.combine(path.current, path.CURRENT))
                    .params({jwt: null, data: {login: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when deleting user with no auth parameters', function (done) {
                req.delete(path.current)
                    .params({jwt: null, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });
        });

        describe('#User Authorization', function () {
            var nonNetworkUser = null;
            var nonNetworkUserJwt = null;

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

                async.series([
                    createUser,
                    createJWT
                ], done);

            });

            it('should fail with 401 when selecting users with invalid jwt', function (done) {
                req.get(path.current)
                    .params({jwt: nonNetworkUserJwt})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when selecting users with refresh jwt', function (done) {
                req.get(path.current)
                    .params({jwt: utils.jwt.admin_refresh})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when getting user with invalid jwt', function (done) {
                req.get(path.current)
                    .params({jwt: nonNetworkUserJwt, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when creating user with invalid jwt', function (done) {
                req.create(path.current)
                    .params({jwt: nonNetworkUserJwt, data: {login: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED)
                    .send(done);
            });

            it('should fail with 401 when updating user with invalid jwt', function (done) {
                req.update(path.current)
                    .params({jwt: nonNetworkUserJwt, id: utils.NON_EXISTING_ID, data: {login: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when deleting user with invalid jwt', function (done) {
                req.delete(path.current)
                    .params({jwt: nonNetworkUserJwt, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });
        });

        describe('#Dummy Access Key Authorization', function () {

            var jwt = null;

            before(function (done) {
                utils.jwt.create(utils.admin.id, 'RegisterDevice', void 0, void 0, function (err, result) {
                    if (err) {
                        return done(err);
                    }
                    jwt = result.accessToken;
                    done()
                })
            });

            it('should fail with 401 when getting list using invalid access key', function (done) {
                req.get(path.current)
                    .params({jwt: jwt})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when selecting user by id using invalid access key', function (done) {
                req.get(path.current)
                    .params({jwt: jwt, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when creating user using invalid access key', function (done) {
                req.create(path.current)
                    .params({jwt: jwt, data: {login: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED)
                    .send(done);
            });

            it('should fail with 401 when updating user using invalid access key', function (done) {
                req.update(path.current)
                    .params({jwt: jwt, id: utils.NON_EXISTING_ID, data: {login: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when deleting user with no auth parameters', function (done) {
                req.delete(path.current)
                    .params({jwt: jwt, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });
        });
    });

    describe('#Not Found', function () {

        it('should fail with 404 when selecting user by non-existing id', function (done) {
            req.get(path.current)
                .params({jwt: utils.jwt.admin, id: utils.NON_EXISTING_ID})
                .expectError(status.NOT_FOUND, format('User with id = ' + utils.NON_EXISTING_ID + ' not found'))
                .send(done);
        });

        it('should fail with 404 when updating user by non-existing id', function (done) {
            req.update(path.current)
                .params({jwt: utils.jwt.admin, id: utils.NON_EXISTING_ID})
                .expectError(status.NOT_FOUND, format('User with id = ' + utils.NON_EXISTING_ID + ' not found'))
                .send(done);
        });

        it('should succeed when deleting user by non-existing id', function (done) {
            req.delete(path.current)
                .params({jwt: utils.jwt.admin, id: utils.NON_EXISTING_ID})
                .send(done);
        });
    });

    after(function (done) {
        utils.clearDataJWT(done);
    });
});
