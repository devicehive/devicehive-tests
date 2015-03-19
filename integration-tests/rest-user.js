var async = require('async');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;
var req = require('./common/request');

describe('REST API User', function () {

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
                .params({user: utils.admin})
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
                .params({user: utils.admin})
                .query('login', user.login)
                .expect([{
                    id: user.id,
                    login: user.login
                }])
                .send(done);
        });

        it('should get non-existing user, no error', function (done) {
            req.get(path.current)
                .params({user: utils.admin})
                .query('login', 'non-existing')
                .expectTrue(function (result) {
                    return utils.core.isEmptyArray(result);
                })
                .send(done);
        });
    });

    describe('#Get Current', function () {

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

        it('should authorize using current user', function (done) {
            req.get(path.combine(path.USER, path.CURRENT))
                .params({user: user})
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

        before(function (done) {
            utils.createUser2(0, void 0, function (err, result) {
                if (err) {
                    return done(err);
                }

                user = result.user;
                done();
            })
        });

        it('should get user by id using admin', function (done) {
            req.get(path.current)
                .params({user: utils.admin, id: user.id})
                .expect({
                    id: user.id,
                    login: user.login,
                    role: 0,
                    status: 0,
                    lastLogin: null
                })
                .send(done);
        });
    });

    describe('#Create OAuth', function () {

        var user = {
            login: utils.getName('oauth-usr-1'),
            password: utils.NEW_USER_PASSWORD
        };

        before(function (done) {
            req.create(path.current)
                .params({
                    user: utils.admin,
                    data: {
                        login: user.login,
                        password: user.password,
                        facebookLogin: 'facebook',
                        role: 0,
                        status: 0 }
                })
                .send(function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    user.id = result.id;
                    done();
                });
        });

        it.skip('should get oauth user by id using admin', function (done) {
            req.get(path.current)
                .params({user: utils.admin, id: user.id})
                .expect({
                    id: user.id,
                    login: user.login,
                    facebookLogin: 'facebook', // TODO: No 'facebookLogin' key
                    role: 0,
                    status: 0,
                    lastLogin: null
                })
                .send(done);
        });
    });

    describe('#Create Existing', function () {

        var LOGIN = utils.getName('oauth-usr-2');

        before(function (done) {
            req.create(path.current)
                .params({
                    user: utils.admin,
                    data: {
                        login: LOGIN,
                        password: utils.NEW_USER_PASSWORD,
                        facebookLogin: 'facebook-2',
                        role: 0,
                        status: 0 }
                })
                .send(done);
        });

        it('should fail with 403 when trying to create user with existing login', function (done) {
            req.create(path.current)
                .params({
                    user: utils.admin,
                    data: {
                        login: LOGIN,
                        password: utils.NEW_USER_PASSWORD,
                        role: 0,
                        status: 0 }
                })
                .expectError(status.FORBIDDEN, 'User with such login already exists. Please, select another one')
                .send(done);
        });

        it.skip('should fail with 403 when trying to create user with existing oauth login', function (done) {
            req.create(path.current)
                .params({
                    user: utils.admin,
                    data: {
                        login: utils.getName('oauth-usr-2-1'),
                        password: utils.NEW_USER_PASSWORD,
                        facebookLogin: 'facebook-2', // TODO: No fail when using same oauth login 'facebook-2'
                        role: 0,
                        status: 0 }
                })
                .expectError(status.FORBIDDEN, 'User with such login already exists. Please, select another one')
                .send(done);
        });
    });

    describe('#Create User Networks', function () {

        var user = {
            login: utils.getName('usr-3'),
            password: utils.NEW_USER_PASSWORD
        };
        var NETWORK = utils.getName('usr-network-3');
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
                    .params({user: utils.admin, data: {name: NETWORK}})
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
                .params({user: utils.admin})
                .send(function (err) {
                    if (err) {
                        return done(err);
                    }

                    req.get(path.current)
                        .params({user: utils.admin, id: user.id})
                        .expect({
                            id: user.id,
                            login: user.login,
                            role: 0,
                            status: 0,
                            lastLogin: null,
                            networks: [{
                                network: {
                                    id: networkId,
                                    name: NETWORK
                                }
                            }]
                        })
                        .send(done);
                });
        });
    });

    describe('#Update', function () {

        var user = {
            login: utils.getName('usr-4'),
            password: utils.NEW_USER_PASSWORD
        };

        before(function (done) {
            req.create(path.current)
                .params({
                    user: utils.admin,
                    data: {
                        login: user.login,
                        password: user.password,
                        googleLogin: 'google-4',
                        facebookLogin: 'facebook-4',
                        githubLogin: 'github-4',
                        role: 0,
                        status: 0
                    }
                })
                .send(function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    user.id = result.id;
                    done();
                });
        });

        it.skip('should update user account', function (done) { // TODO: Oauth logins don't return (googleLogin, facebookLogin etc.)

            var update = {
                login: utils.getName('usr-4-upd'),
                googleLogin: 'google-4-upd',
                facebookLogin: 'facebook-4-upd',
                githubLogin: 'github-4-upd',
                role: 1,
                status: 1
            };

            req.update(path.current)
                .params({user: utils.admin, id: user.id, data: update})
                .send(function (err) {
                    if (err) {
                        return done(err);
                    }

                    req.get(path.current)
                        .params({user: utils.admin, id: user.id})
                        .expect(update)
                        .expect({lastLogin: null})
                        .send(done);
                });
        });
    });

    describe('#Update Partial', function () {

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

        it('should partially update user account', function (done) {
            req.update(path.current)
                .params({user: utils.admin, id: user.id, data: {status: 1}})
                .send(function (err) {
                    if (err) {
                        return done(err);
                    }

                    req.get(path.current)
                        .params({user: utils.admin, id: user.id})
                        .expect({
                            id: user.id,
                            login: user.login,
                            role: 0,
                            status: 1,
                            lastLogin: null
                        })
                        .send(done);
                });
        });
    });

    describe('#Update Current', function () {

        var user = {
            login: utils.getName('usr-5'),
            password: utils.NEW_USER_PASSWORD
        };

        before(function (done) {
            req.create(path.current)
                .params({
                    user: utils.admin,
                    data: {
                        login: user.login,
                        password: user.password,
                        googleLogin: 'google-5',
                        facebookLogin: 'facebook-5',
                        githubLogin: 'github-5',
                        role: 1,
                        status: 0
                    }
                })
                .send(function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    user.id = result.id;
                    done();
                });
        });

        it.skip('should update user account at \'/current\' path', function (done) { // TODO: Oauth logins don't return (googleLogin, facebookLogin etc.)

            var update = {
                login: utils.getName('usr-5-upd'),
                password: utils.NEW_USER_PASSWORD + '*',
                googleLogin: 'google-5-upd',
                facebookLogin: 'facebook-5-upd',
                githubLogin: 'github-5-upd',
                role: 0,
                status: 1
            };

            function updateUser(callback) {
                req.update(path.combine(path.current, path.CURRENT))
                    .params({user: user, data: update})
                    .send(callback);
            }

            function failGetWithOldCredentials(callback) {
                req.get(path.combine(path.current, path.CURRENT))
                    .params({user: user})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(callback);
            }

            function getOtherPropsUnchanged(callback) {
                req.get(path.current)
                    .params({user: utils.admin, id: user.id})
                    .expect({
                        login: utils.getName('usr-5-upd'),
                        googleLogin: 'google-5-upd',
                        facebookLogin: 'facebook-5-upd',
                        githubLogin: 'github-5-upd',
                        role: 0,
                        status: 1
                    })
                    .send(callback);
            }

            async.series([
                updateUser,
                failGetWithOldCredentials,
                getOtherPropsUnchanged
            ], done);
        });
    });

    describe('#Delete', function () {

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
                .params({user: utils.admin, id: user.id})
                .send(function (err) {
                    if (err) {
                        done(err);
                    }

                    req.get(path.current)
                        .params({user: utils.admin, id: user.id})
                        .expectError(status.NOT_FOUND, format('User with id = %s not found', user.id))
                        .send(done);
                });
        });
    });

    describe('#Bad Request', function () {
        it('should fail with 400 when trying to create user with invalid parameters', function (done) {
            req.create(path.current)
                .params({user: utils.admin, data: {}})
                .expectError(status.BAD_REQUEST)
                .send(done);
        });
    });

    describe('#Not Authorized', function () {
        describe('#No Authorization', function () {
            it('should fail with 401 if auth parameters omitted', function (done) {
                req.get(path.current)
                    .params({user: null})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when selecting user by id, auth parameters omitted', function (done) {
                req.get(path.current)
                    .params({user: null, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when selecting user by \'/current\', auth parameters omitted', function (done) {
                req.get(path.combine(path.current, path.CURRENT))
                    .params({user: null})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when creating user with no auth parameters', function (done) {
                req.create(path.current)
                    .params({user: null, data: {login: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when updating user with no auth parameters', function (done) {
                req.update(path.current)
                    .params({user: null, id: utils.NON_EXISTING_ID, data: {login: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when updating user by \'/current\' with no auth parameters', function (done) {
                req.update(path.combine(path.current, path.CURRENT))
                    .params({user: null, data: {login: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when deleting user with no auth parameters', function (done) {
                req.delete(path.current)
                    .params({user: null, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });
        });

        describe('#User Authorization', function () {

            var nonNetworkUser = null;

            before(function (done) {
                utils.createUser2(1, void 0, function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    nonNetworkUser = result.user;
                    done();
                });
            });

            it('should fail with 401 when selecting users with invalid user', function (done) {
                req.get(path.current)
                    .params({user: nonNetworkUser})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when getting user with invalid user', function (done) {
                req.get(path.current)
                    .params({user: nonNetworkUser, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when creating user with invalid user', function (done) {
                req.create(path.current)
                    .params({user: nonNetworkUser, data: {login: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when updating user with invalid user', function (done) {
                req.update(path.current)
                    .params({user: nonNetworkUser, id: utils.NON_EXISTING_ID, data: {login: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when deleting user with invalid user', function (done) {
                req.delete(path.current)
                    .params({user: nonNetworkUser, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });
        });

        describe('#Dummy Access Key Authorization', function () {

            var accessKey = null;

            before(function (done) {
                req.create(path.CURRENT_ACCESS_KEY)
                    .params(utils.accessKey.getParamsObj(utils.getName('user-dummy-access-key'), utils.admin, void 0, void 0, void 0, ['RegisterDevice']))
                    .send(function (err, result) {
                        if (err) {
                            return done(err);
                        }

                        accessKey = result.key;
                        done();
                    });
            });

            it('should fail with 401 when getting list using invalid access key', function (done) {
                req.get(path.current)
                    .params({accessKey: accessKey})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when selecting user by id using invalid access key', function (done) {
                req.get(path.current)
                    .params({accessKey: accessKey, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when creating user using invalid access key', function (done) {
                req.create(path.current)
                    .params({accessKey: accessKey, data: {login: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when updating user using invalid access key', function (done) {
                req.update(path.current)
                    .params({accessKey: accessKey, id: utils.NON_EXISTING_ID, data: {login: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when deleting user with no auth parameters', function (done) {
                req.delete(path.current)
                    .params({accessKey: accessKey, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });
        });
    });

    describe('#Not Found', function () {

        it('should fail with 404 when selecting user by non-existing id', function (done) {
            req.get(path.current)
                .params({user: utils.admin, id: utils.NON_EXISTING_ID})
                .expectError(status.NOT_FOUND, format('User with id = %s not found', utils.NON_EXISTING_ID))
                .send(done);
        });

        it('should fail with 404 when updating user by non-existing id', function (done) {
            req.update(path.current)
                .params({user: utils.admin, id: utils.NON_EXISTING_ID})
                .expectError(status.NOT_FOUND, format('User with id = %s not found', utils.NON_EXISTING_ID))
                .send(done);
        });

        it('should succeed when deleting user by non-existing id', function (done) {
            req.delete(path.current)
                .params({user: utils.admin, id: utils.NON_EXISTING_ID})
                .send(done);
        });
    });

    after(function (done) {
        utils.clearResources(done);
    });
});
