var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');

describe('REST API Info', function () {
    this.timeout(90000);
    
    describe('Should Return Info', function () {

        it('should return api info', function (done) {
            utils.get(path.INFO, {}, function (err, result) {
                if (err) {
                    done(err);
                }

                assert.strictEqual(utils.core.hasStringValue(result.apiVersion), true);
                assert.strictEqual(utils.core.hasStringValue(result.serverTimestamp), true);
                assert.strictEqual(utils.core.hasStringValue(result.webSocketServerUrl), true);

                done();
            });
        });

        it('should return cache info', function (done) {
            utils.get(path.INFO_CACHE, {}, function (err, result) {
                if (err) {
                    done(err);
                }
    
                assert.strictEqual(utils.core.hasStringValue(result.serverTimestamp), true);
                assert.strictEqual(utils.core.hasStringValue(result.cacheStats), true);
    
                done();
            });
        });
        
    });

    after(function (done) {
        utils.clearDataJWT(done);
    });
    
});