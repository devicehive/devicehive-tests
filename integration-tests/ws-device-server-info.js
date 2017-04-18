var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API Device Server Info', function () {
    var url = null;

    before(function (done) {
        req.get(path.INFO).params({jwt: utils.jwt.admin}).send(function (err, result) {
            if (err) {
                return done(err);
            }
            url = result.webSocketServerUrl;
            done();
        });
    });

    describe('#server/info', function () {

        it('should get server info, no auth', function (done) {
            var device = new Websocket(url, 'device');
            device.connect(function (err) {
                if (err) {
                    return done(err);
                }

                var requestId = getRequestId();
                device.params({
                        action: 'server/info',
                        requestId: requestId
                    })
                    .expect({
                        action: 'server/info',
                        status: 'success',
                        requestId: requestId
                    })
                    .assert(function (result) {
                        utils.hasPropsWithValues(result.info, ['apiVersion', 'serverTimestamp', 'restServerUrl']);
                    })
                    .send(done);
            });
        });
    });
});
