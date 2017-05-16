var assert = require('assert');
var async = require('async');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;
var req = require('./common/request');

describe('REST API JSON Web Tokens', function () {
    this.timeout(90000);

    var user = null;
    var inactiveUser = null;

    before(function (done) {

        function createUser(callback) {
            utils.createUser2(1, void 0, function (err, result) {
                if (err) {
                    return callback(err);
                }

                user = result.user;
                callback();
            });
        }

        function createInactiveUser(callback) {
            utils.createUser3(1, void 0, 1, function (err, result) {
                if (err) {
                    return callback(err);
                }

                inactiveUser = result.user;
                callback();
            });
        }

        async.series([
            createUser,
            createInactiveUser
        ], done);
    });

    describe('#Create', function() {

        var jwt1 = null;
        var jwt2 = null;

        before(function (done) {
            var params = [
                {
                    user: user,
                    actions: 'ManageToken'
                },
                {
                    user: user
                }
            ];
            utils.jwt.createMany(params, function (err, result) {
                if (err) {
                    return done(err);
                }
                jwt1 = result[0];
                jwt2 = result[1];
                done();
            });
        });

        it('should create token with all permissions, networks and devices', function (done) {
            utils.create(path.JWT + '/create', {jwt: utils.jwt.admin,
                data: {
                    userId: 1,
                    actions: ['*'],
                    networkIds: ['*'],
                    deviceGuids: ['*']
                }
            }, function (err, result) {
                if (err) {
                    return done(err);
                }

                assert(result.accessToken != null);
                assert(result.refreshToken != null);

                done();
            });
        });

        it('should return error when creating token with refresh jwt', function (done) {
            utils.create(path.JWT + '/create', {jwt: utils.jwt.admin_refresh,
                data: {
                    userId: 1,
                    actions: ['*'],
                    networkIds: ['*'],
                    deviceGuids: ['*']
                }
            }, function (err) {
                assert.strictEqual(err.error, 'Unauthorized');
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                done();
            });
        });

        it('should create token with ManageToken permission', function (done) {
            utils.create(path.JWT + '/create', {jwt: jwt1,
                data: {
                    userId: 1,
                    actions: ['*'],
                    networkIds: ['*'],
                    deviceGuids: ['*']
                }
            }, function (err, result) {
                if (err) {
                    return done(err);
                }

                assert(result.accessToken != null);
                assert(result.refreshToken != null);

                done();
            });
        });

        it('should not create token without ManageToken permission', function(done){
            utils.create(path.JWT + '/create', {jwt: jwt2,
                data: {
                    userId: 1,
                    actions: ['*'],
                    networkIds: ['*'],
                    deviceGuids: ['*']
                }
            }, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Unauthorized');
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                done();
            });
        });

        it('should not create token for invalid User', function (done) {
            utils.create(path.JWT + '/create', {jwt: utils.jwt.admin,
                data: {
                    userId: 9999999999999,
                    actions: ['*'],
                    networkIds: ['*'],
                    deviceGuids: ['*']
                }
            }, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Unauthorized');
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                done();
            });
        });

        it('should not create token with error User is not active', function (done) {
            utils.create(path.JWT + '/create', {jwt: utils.jwt.admin,
                data: {
                    userId: inactiveUser.id,
                    actions: ['*'],
                    networkIds: ['*'],
                    deviceGuids: ['*']
                }
            }, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Unauthorized');
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                done();
            });

        });
    });

    describe('#Refresh', function() {

        var refresh1 = null;
        var refresh2 = null;

        before(function (done) {
            var params = [
                {
                    user: user
                }
            ];
            utils.jwt.createManyRefresh(params, function (err, result) {
                if (err) {
                    return done(err);
                }
                refresh1 = result[0];
                refresh2 = result[1];
                done();
            });
        });

        it('should not refresh token with error refresh token is not valid', function (done) {
            utils.create(path.JWT + '/refresh', {
                data: {
                    refreshToken: utils.jwt.admin_refresh_invalid
                }
            }, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Bad Request');
                assert.strictEqual(err.httpStatus, status.BAD_REQUEST);
                done();
            });
        });

        it('should not refresh token with error refresh token has expired', function (done) {
            utils.create(path.JWT + '/refresh', {
                data: {
                    refreshToken: utils.jwt.admin_refresh_exp
                }
            }, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Unauthorized');
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                done();
            });
        });
    });
});
