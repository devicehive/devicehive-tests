var async = require('async');
var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API Device Unit', function () {
    var url = null;

    var DEVICE = utils.getName('ws-device');
    var DEVICE_KEY = utils.getName('ws-device-key');

    var device = {
        name: DEVICE,
        key: DEVICE_KEY,
        status: 'Online',
        data: {a: '1', b: '2'},
        network: {
            name: utils.getName('ws-network'),
            description: 'lorem ipsum dolor sit amet'
        },
        deviceClass: {
            name: DEVICE,
            version: '1',
            isPermanent: true,
            offlineTimeout: 1234,
            data: {c: '3', d: '4'},
            equipment: [{
                name: "_integr-test-eq",
                code: "321",
                type: "_integr-test-type",
                data: {e: '5', f: '6'}
            }]

        }
    };
    var deviceId = utils.getName('ws-device-id');
    var conn = null;

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

        function createConn(callback) {
            conn = new Websocket(url, 'device');
            conn.connect(callback);
        }

        function authenticateConn(callback) {
            conn.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    deviceId:  deviceId,
                    deviceKey: DEVICE_KEY
                })
                .send(callback);
        }

        async.series([
            getWsUrl,
            createConn,
            authenticateConn
        ], done);
    });

    describe('#device/get', function () {

        before(function (done) {
            req.update(path.get(path.DEVICE, deviceId))
                .params({user: utils.admin, data: device})
                .send(done);
        });

        it('should get information about current device, device auth', function (done) {
            var requestId = getRequestId();

            conn.params({
                    action: 'device/get',
                    requestId: requestId,
                    deviceId: deviceId
                })
                .expect(device)
                .assert(function (result) {
                })
                .send(done);
        });

        it('should fail when using wrong access key', function (done) {
            conn.params({
                    action: 'device/get',
                    requestId: getRequestId(),
                    deviceId: 'invalid-device-id',
                    deviceKey: 'invalid-device-key'
                })
                .expectError(401, 'Unauthorized')
                .send(done);
        });

        after(function (done) {
            utils.clearData(done);
        });
    });

    describe('#device/save', function () {

        it('should get information about current device, device auth', function (done) {

            function saveDevice(callback) {
                var requestId = getRequestId();
                    conn.params({
                        action: 'device/save',
                        requestId: requestId,
                        deviceId: deviceId,
                        device: device
                    })
                    .expect({
                        action: 'device/save',
                        requestId: requestId,
                        status: 'success'
                    })
                    .send(callback);
            }

            function checkDevice(callback) {
                req.get(path.DEVICE)
                    .params({user: utils.admin, id: deviceId})
                    .expect(device)
                    .send(callback);
            }

            async.series([
                saveDevice,
                checkDevice
            ], done);
        });
    });

    after(function (done) {
        conn.close();
        utils.clearData(done);
    });
});
