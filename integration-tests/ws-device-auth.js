var async = require('async');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API Device Authentication', function () {
    this.timeout(90000);
    var url = null;

    var DEVICE = utils.getName('ws-device');
    var NETWORK = utils.getName('ws-device-network');

    var deviceId = utils.getName('ws-device-id');
    var token = null;


    before(function (done) {

        function getWsUrl(callback) {

            req.get(path.INFO).params({jwt: utils.jwt.admin}).send(function (err, result) {
                if (err) {
                    return callback(err);
                }
                url = result.webSocketServerUrl;
                callback();
            });
        }

        function createDevice(callback) {
            req.update(path.get(path.DEVICE, deviceId))
                .params(utils.device.getParamsObj(DEVICE, utils.jwt.admin,
                    {name: NETWORK}, {name: DEVICE, version: '1'}))
                .send(callback);
        }

        function createToken(callback) {
            var args = {
                actions: [
                    'GetDeviceCommand',
                    'CreateDeviceCommand',
                    'UpdateDeviceCommand'
                ],
                deviceIds: void 0,
                networkIds: void 0
            };
            utils.jwt.create(utils.admin.id, args.actions, args.networkIds,  args.deviceIds, function (err, result) {
                if (err) {
                    return callback(err);
                }
                token = result.access_token;
                callback()
            })
        }

        async.series([
            getWsUrl,
            createDevice,
            createToken
        ], done);
    });

    describe('#authenticate', function () {

        it('should authenticate using jwt', function (done) {
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
                        token:  token
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

        it('should return error when using invalid token', function (done) {
            var device = null;

            function createConnection(callback) {
                device = new Websocket(url, 'device');
                device.connect(callback);
            }

            function runTest(callback) {
                device.params({
                        action: 'authenticate',
                        requestId: getRequestId(),
                        token: 'invalid_token'
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
        utils.clearDataJWT(done);
    });
});
