var async = require('async');
var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API Device', function () {
    this.timeout(90000);
    var url = null;

    var DEVICE = utils.getName('ws-device');
    var NETWORK = utils.getName('ws-cmd-network');
    var NETWORK_KEY = utils.getName('ws-cmd-network-key');
    var token = null;

    var device = {
        name: DEVICE,
        data: {a: '1', b: '2'}
    };
    var deviceId = utils.getName('ws-device-id');

    before(function (done) {
        req.get(path.INFO).params({jwt: utils.jwt.admin}).send(function (err, result) {
            if (err) {
                return done(err);
            }
            url = result.webSocketServerUrl;
            done();
        });
    });

    describe('#device/get', function () {

        var conn = null;
        var networkId = null;

        before(function (done) {
        	function createNetwork(callback) {
                var params = {
                    jwt: utils.jwt.admin,
                    data: { name: NETWORK, key: NETWORK_KEY }
                };

                utils.create(path.NETWORK, params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    networkId = result.id;
                    callback();
                });
            }

            function createDevice(callback) {
            	device.networkId = networkId;
                req.update(path.get(path.DEVICE, deviceId))
                    .params({jwt: utils.jwt.admin, data: device})
                    .send(callback);
            }

            function createConn(callback) {
                conn = new Websocket(url);
                conn.connect(callback);
            }

            function createToken(callback) {
                var args = {
                    actions: [
                        'CreateDeviceNotification',
                        'GetDeviceNotification',
                        'GetDevice',
                        'ManageNetwork'
                    ],
                    deviceIds: deviceId,
                    networkIds: void 0
                };
                utils.jwt.create(utils.admin.id, args.actions, args.networkIds, args.deviceIds, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    token = result.accessToken;
                    callback()
                })
            }

            function authenticateConn(callback) {
                conn.params({
                        action: 'authenticate',
                        requestId: getRequestId(),
                        deviceId: deviceId,
                        token: token
                    })
                    .send(callback);
            }

            async.series([
            	createNetwork,
                createDevice,
                createToken,
                createConn,
                authenticateConn
            ], done);
        });

        it('should return 401 error for valid refresh jwt', function (done) {
            req.update(path.get(path.DEVICE, deviceId))
                .params({jwt: utils.jwt.admin_refresh, data: device})
                .expectError(401, 'Unauthorized')
                .send(done);
 
        });

        it('should get information about current device', function (done) {
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

        after(function (done) {
            conn.close();
            utils.clearDataJWT(done);
        });
    });

    describe('#device/list', function () {

        var conn = null;
        var networkId = null;

        before(function (done) {
            function createNetwork(callback) {
                var params = {
                    jwt: utils.jwt.admin,
                    data: { name: NETWORK, key: NETWORK_KEY }
                };

                utils.create(path.NETWORK, params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    networkId = result.id;
                    callback();
                });
            }

            function createDevice(callback) {
                device.networkId = networkId;
                req.update(path.get(path.DEVICE, deviceId))
                    .params({jwt: utils.jwt.admin, data: device})
                    .send(callback);
            }

            function createConn(callback) {
                conn = new Websocket(url);
                conn.connect(callback);
            }

            function createToken(callback) {
                var args = {
                    actions: [
                        'CreateDeviceNotification',
                        'GetDeviceNotification',
                        'GetDevice',
                        'ManageNetwork'
                    ],
                    deviceIds: deviceId,
                    networkIds: void 0
                };
                utils.jwt.create(utils.admin.id, args.actions, args.networkIds, args.deviceIds, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    token = result.accessToken;
                    callback()
                })
            }

            function authenticateConn(callback) {
                conn.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    deviceId: deviceId,
                    token: token
                })
                    .send(callback);
            }

            async.series([
                createNetwork,
                createDevice,
                createToken,
                createConn,
                authenticateConn
            ], done);
        });

        it('should get information about device list', function (done) {
            var requestId = getRequestId();

            var expectedDevice = utils.core.clone(device);
            delete expectedDevice.key;

            conn.params({
                action: 'device/list',
                requestId: requestId
            })
                .expect({
                    action: 'device/list',
                    requestId: requestId,
                    status: 'success',
                    devices: [expectedDevice]
                })
                .send(done);
        });

        after(function (done) {
            conn.close();
            utils.clearDataJWT(done);
        });
    });

    describe('#device/save', function () {

        var conn = null;
        var networkId = null;

        before(function (done) {
        	function createNetwork(callback) {
                var params = {
                    jwt: utils.jwt.admin,
                    data: { name: NETWORK, key: NETWORK_KEY }
                };

                utils.create(path.NETWORK, params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    networkId = result.id;
                    callback();
                });
            }

            function createDevice(callback) {
            	device.networkId = networkId;
                req.update(path.get(path.DEVICE, deviceId))
                    .params({jwt: utils.jwt.admin, data: device})
                    .send(callback);
            }

            function createConn(callback) {
                conn = new Websocket(url);
                conn.connect(callback);
            }

            function createToken(callback) {
                var args = {
                    actions: [
                        'CreateDeviceNotification',
                        'GetDeviceNotification',
                        'ManageNetwork',
                        'RegisterDevice'
                    ],
                    deviceIds: void 0,
                    networkIds: void 0
                };
                utils.jwt.create(utils.admin.id, args.actions, args.networkIds,  args.deviceIds, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    token = result.accessToken;
                    callback()
                })
            }

            function authenticateConn(callback) {
                conn.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    deviceId: deviceId,
                    token: token
                })
                    .send(callback);
            }

            async.series([
            	createNetwork,
                createDevice,
                createToken,
                createConn,
                authenticateConn
            ], done);
        });

        describe('#unauthorized', function(done) {
            it('should return error using refresh jwt', function() {
                req.get(path.DEVICE)
                    .params({jwt: utils.jwt.admin_refresh, id: deviceId})
                    .expectError(401, 'Unauthorized')
                    .send(done);
            });
        });

        it('should save information about device', function (done) {

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
                    .params({jwt: utils.jwt.admin, id: deviceId})
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
            utils.clearDataJWT(done);
        });
    });
});
