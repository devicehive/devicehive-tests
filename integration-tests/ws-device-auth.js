var async = require('async');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API Device Authentication', function () {
    var url = null;

    var DEVICE = utils.getName('ws-device');
    var DEVICE_KEY = utils.getName('ws-device-key');
    var NETWORK = utils.getName('ws-device-network');

    var deviceId = utils.getName('ws-device-id');

    before(function (done) {
        utils.clearOldEntities(function () {
            init(done);
        });
    });

    function init(done) {

        function getWsUrl(callback) {

            req.get(path.INFO).params({user: utils.admin}).send(function (err, result) {
                if (err) {
                    return callback(err);
                }
                url = result.webSocketServerUrl;
                callback();
            });
        }

        function createDevice(callback) {
            req.update(path.get(path.DEVICE, deviceId))
                .params(utils.device.getParamsObj(DEVICE, utils.admin, DEVICE_KEY,
                    {name: NETWORK}, {name: DEVICE, version: '1'}))
                .send(callback);
        }

        async.series([
            getWsUrl,
            createDevice
        ], done);
    }

    describe('#authenticate', function () {

        it('should authenticate using deviceId / deviceKey', function (done) {
            var device = null;
            var requestId = getRequestId();

            function createConnection(callback) {
                device = new Websocket(url, 'device');
                device.connect(callback);
            }

            function runTest(callback) {

                device.params({
                        action: 'authenticate',
                        requestId: requestId,
                        deviceId:  deviceId,
                        deviceKey: DEVICE_KEY
                    })
                    .expect({
                        action: 'authenticate',
                        status: 'success',
                        requestId: requestId
                    })
                    .send(callback);
            }

            async.series([
                createConnection,
                runTest
            ], function (err) {
                if (device) {
                    device.close();
                }
                done(err);
            });
        });

        it('should return error when using invalid deviceId / deviceKey', function (done) {
            var device = null;

            function createConnection(callback) {
                device = new Websocket(url, 'device');
                device.connect(callback);
            }

            function runTest(callback) {
                device.params({
                        action: 'authenticate',
                        requestId: getRequestId(),
                        deviceId: utils.NON_EXISTING_ID,
                        deviceKey: 'non-existing-key'
                    })
                    .expectError(401, 'Invalid credentials')
                    .send(callback);
            }

            async.series([
                createConnection,
                runTest
            ], function (err) {
                if (device) {
                    device.close();
                }

                done(err);
            });
        });
    });

    after(function (done) {
        utils.clearResources(done);
    });
});
