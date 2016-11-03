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

    before(function (done) {
        utils.createUser2(1, void 0, function (err, result) {
            if (err) {
                return done(err);
            }

            user = result.user;
            done();
        });
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

        it('should create token with ManageToken permission', function (done) {
            utils.create(path.JWT, {jwt: jwt1,
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

                assert(result.access_token != null);
                assert(result.refresh_token != null);

                done();
            });
        });

        it('should not create token without ManageToken permission', function(done){
            utils.create(path.JWT, {jwt: jwt2,
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
        })
    });

    describe('#Refresh', function() {

    });
});
