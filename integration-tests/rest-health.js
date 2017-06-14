var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;

describe('REST API Health', function () {

    it('should return OK status for backend', function (done) {
        utils.getBackend(path.HEALTH, {}, function (err, result) {
            if (err) {
                done(err);
            }
            done();
        }, status.EXPECTED_READ)
    });

    it('should return OK status for frontend', function (done) {
        utils.getBackend(path.HEALTH, {}, function (err, result) {
            if (err) {
                done(err);
            }
            done();
        }, status.EXPECTED_READ)
    });

    after(function (done) {
        utils.clearDataJWT(done);
    });
});