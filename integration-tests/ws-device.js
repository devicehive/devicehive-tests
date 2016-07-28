var async = require('async');
var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API Device Unit', function () {
    this.timeout(90000);
    var url = null;

    var DEVICE = utils.getName('ws-device');
    var accessKey = null;

    var device = {
        name: DEVICE,
        status: 'Online',
        data: {a: '1', b: '2'},
        network: {
            name: utils.getName('ws-network'),
            description: 'lorem ipsum dolor sit amet'
        },
        deviceClass: {
            name: DEVICE,
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

    before(function (done) {
        req.get(path.INFO).params({user: utils.admin}).send(function (err, result) {
            if (err) {
                return done(err);
            }
            url = result.webSocketServerUrl;
            done();
        });
    });

    describe('#device/get', function () {

        var conn = null;
        var conn2 = null;

        before(function (done) {
            function createDevice(callback) {
                req.update(path.get(path.DEVICE, deviceId))
                    .params({user: utils.admin, data: device})
                    .send(callback);
            }

            function createConn(callback) {
                conn = new Websocket(url, 'device');
                conn.connect(callback);
            }

            function createAccessKey(callback) {
                var args = {
                    label: utils.getName('ws-access-key'),
                    actions: [
                        'CreateDeviceNotification',
                        'GetDeviceNotification',
                        'ManageNetwork'
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

            function createConn2(callback) {
                conn2 = new Websocket(url, 'device');
                conn2.connect(callback);
            }

            function authenticateConn(callback) {
                conn.params({
                        action: 'authenticate',
                        requestId: getRequestId(),
                        deviceId: deviceId,
                        accessKey: accessKey
                    })
                    .send(callback);
            }

            async.series([
                createDevice,
                createAccessKey,
                createConn,
                createConn2,
                authenticateConn
            ], done);
        });

        it('should get information about current device, device auth', function (done) {
            var requestId = getRequestId();

            var expectedDevice = utils.core.clone(device);
            delete expectedDevice.key;

            conn.params({
                    action: 'device/get',
                    requestId: requestId
                })
                .expect({
                    action: 'device/get',
                    requestId: requestId,
                    status: 'success',
                    device: expectedDevice
                })
                .send(done);
        });

        it('should fail when using wrong access key', function (done) {
            conn2.params({
                    action: 'device/get',
                    requestId: getRequestId(),
                    deviceId: 'invalid-device-id',
                    deviceKey: 'invalid-device-key'
                })
                .expectError(401, 'Unauthorized')
                .send(done);
        });

        after(function (done) {
            conn.close();
            conn2.close();
            utils.clearData(done);
        });
    });

    describe('#device/save', function () {

        var conn = null;

        before(function (done) {
            function createDevice(callback) {
                req.update(path.get(path.DEVICE, deviceId))
                    .params({user: utils.admin, data: device})
                    .send(callback);
            }

            function createConn(callback) {
                conn = new Websocket(url, 'device');
                conn.connect(callback);
            }

            function createAccessKey(callback) {
                var args = {
                    label: utils.getName('ws-access-key'),
                    actions: [
                        'CreateDeviceNotification',
                        'GetDeviceNotification',
                        'ManageNetwork',
                        'RegisterDevice'
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

            function createConn2(callback) {
                conn2 = new Websocket(url, 'device');
                conn2.connect(callback);
            }

            function authenticateConn(callback) {
                conn.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    deviceId: deviceId,
                    accessKey: accessKey
                })
                    .send(callback);
            }

            async.series([
                createDevice,
                createAccessKey,
                createConn,
                authenticateConn
            ], done);
        });

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
                var expectedDevice = utils.core.clone(device);
                delete expectedDevice.key;

                req.get(path.DEVICE)
                    .params({user: utils.admin, id: deviceId})
                    .expect(expectedDevice)
                    .send(callback);
            }

            async.series([
                saveDevice,
                checkDevice
            ], done);
        });

        after(function (done) {
            conn.close();
            utils.clearData(done);
        });
    });
});
