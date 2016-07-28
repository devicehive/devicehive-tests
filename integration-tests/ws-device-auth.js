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
    var accessKey = null;


    before(function (done) {

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
                .params(utils.device.getParamsObj(DEVICE, utils.admin,
                    {name: NETWORK}, {name: DEVICE, version: '1'}))
                .send(callback);
        }

        function createAccessKey(callback) {
            var args = {
                label: utils.getName('ws-access-key'),
                actions: [
                    'GetDeviceCommand',
                    'CreateDeviceCommand',
                    'UpdateDeviceCommand'
                ]
            };
            utils.accessKey.create(utils.admin, args.label, args.actions, void 0, args.networkIds,
                function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    accessKey = result.key;
                    callback();
                })
        }

        async.series([
            getWsUrl,
            createDevice,
            createAccessKey
        ], done);
    });

    describe('#authenticate', function () {

        it('should authenticate using access key', function (done) {
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
                        accessKey:  accessKey
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

        it('should return error when using invalid access key', function (done) {
            var device = null;

            function createConnection(callback) {
                device = new Websocket(url, 'device');
                device.connect(callback);
            }

            function runTest(callback) {
                device.params({
                        action: 'authenticate',
                        requestId: getRequestId(),
                        accessKey: null
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
        utils.clearData(done);
    });
});
