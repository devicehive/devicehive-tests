var async = require('async');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;
var req = require('./common/request');

describe('REST API User Network', function () {
    this.timeout(30000);

    var NETWORK = utils.getName('user-network');
    var networkId = null;
    var userId = null;

    before(function (done) {

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

    describe('#Update', function () {
        it('should update user network', function (done) {
            req.update(path.current)
                .params({user: utils.admin, id: networkId})
                .send(function (err) {
                    if (err) {
                        return done(err);
                    }

                    req.get(path.current)
                        .params({user: utils.admin, id: networkId})
                        .expect({
                            network: {
                                id: networkId,
                                name: NETWORK
                            }
                        })
                        .send(done);
                });
        });
    });

    describe('#Delete', function () {
        it.skip('should delete user network', function (done) {
            req.delete(path.current)
                .params({user: utils.admin, id: networkId})
                .send(function (err) {
                    if (err) {
                        return done(err);
                    }

                    req.get(path.current)
                        .params({user: utils.admin, id: networkId})
                        .expectError(status.NOT_FOUND,
                            format('Network with id %s for user with is %s was not found', networkId, userId))// TODO: swap networkId <> userId in error message
                        .send(done);
                });
        });
    });

    describe('#Unauthorized', function () {

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

        describe('#No Authorization', function () {
            it('should fail with 401 when selecting user network by id, auth parameters omitted', function (done) {
                req.get(path.current)
                    .params({user: null, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when updating user network with no auth parameters', function (done) {
                req.update(path.current)
                    .params({user: null, id: utils.NON_EXISTING_ID, data: {name: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when deleting user network with no auth parameters', function (done) {
                req.delete(path.current)
                    .params({user: null, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });
        });

        describe('#User Authorization', function () {
            it('should fail with 401 when creating user network with invalid user', function (done) {
                req.get(path.current)
                    .params({user: nonNetworkUser, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when updating user network with invalid user', function (done) {
                req.update(path.current)
                    .params({user: nonNetworkUser, id: utils.NON_EXISTING_ID, data: {name: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when deleting user network with invalid user', function (done) {
                req.delete(path.current)
                    .params({user: nonNetworkUser, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });
        });

        describe('#Dummy Access Key Authorization', function () {

            var accessKey = null;

            before(function (done) {
                req.create(path.CURRENT_ACCESS_KEY)
                    .params(utils.accessKey.getParamsObj(utils.getName('user-network-dummy-access-key'),
                        utils.admin, void 0, void 0, void 0, ['RegisterDevice']))
                    .send(function (err, result) {
                        if (err) {
                            return done(err);
                        }

                        accessKey = result.key;
                        done();
                    });
            });

            it('should fail with 401 when selecting user network by id using invalid access key', function (done) {
                req.get(path.current)
                    .params({accessKey: accessKey, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when updating user network using invalid access key', function (done) {
                req.update(path.current)
                    .params({accessKey: accessKey, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when deleting user network with no auth parameters', function (done) {
                req.delete(path.current)
                    .params({accessKey: accessKey, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });
        });
    });

    describe('#Not Found', function () {

        it.skip('should fail with 404 when selecting user network by non-existing id', function (done) {
            req.get(path.current)
                .params({user: utils.admin, id: utils.NON_EXISTING_ID})
                .expectError(status.NOT_FOUND,
                    format('Network with id %s for user with is %s was not found', utils.NON_EXISTING_ID, userId))// TODO: swap networkId <> userId in error message
                .send(done);
        });

        it('should fail with 404 when updating user network by non-existing id', function (done) {
            req.update(path.current)
                .params({user: utils.admin, id: utils.NON_EXISTING_ID})
                .expectError(status.NOT_FOUND, format('Network with id = %s not found', utils.NON_EXISTING_ID))
                .send(done);
        });

        it('should succeed when deleting user network by non-existing id', function (done) {
            req.delete(path.current)
                .params({user: utils.admin, id: utils.NON_EXISTING_ID})
                .send(done);
        });
    });

    after(function (done) {
        utils.clearData(done);
    });
});
