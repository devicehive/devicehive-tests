var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');

describe('REST API Info', function () {

    it('should return info', function (done) {
        utils.get(path.INFO, {}, function (err, result) {
            if (err) {
                done(err);
            }

            assert.strictEqual(utils.core.hasStringValue(result.apiVersion), true);
            assert.strictEqual(utils.core.hasStringValue(result.serverTimestamp), true);
            assert.strictEqual(utils.core.hasStringValue(result.webSocketServerUrl), true);

            done();
        })
    })
})