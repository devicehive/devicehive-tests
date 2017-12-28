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

    var DEVICE = utils.getName('ws-device-1');
    var DEVICE2 = utils.getName('ws-device-2');
    var NETWORK = utils.getName('ws-cmd-network');
    var NETWORK_KEY = utils.getName('ws-cmd-network-key');
    var token = null;

    var device = {
        name: DEVICE,
        data: {a: '1', b: '2'}
    };
    var device2 = {
        name: DEVICE2,
        data: {a: '11', b: '12'}
    };
    
    var deviceId = utils.getName('ws-device-id-1');
    var deviceId2 = utils.getName('ws-device-id-2');

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
        var adminConn = null;
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

            function createAdminConn(callback) {
                adminConn = new Websocket(url);
                adminConn.connect(callback);
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
                    networkIds: void 0,
                    deviceTypeIds: void 0
                };
                utils.jwt.create(utils.admin.id, args.actions, args.networkIds, args.deviceTypeIds, function (err, result) {
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
                        token: token
                    })
                    .send(callback);
            }

            function authenticateAdminConn(callback) {
                adminConn.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: utils.jwt.admin
                })
                    .send(callback);
            }

            async.series([
            	createNetwork,
                createDevice,
                createToken,
                createConn,
                createAdminConn,
                authenticateConn,
                authenticateAdminConn
            ], done);
        });

        it('should return 401 error for valid refresh jwt', function (done) {
            req.update(path.get(path.DEVICE, deviceId))
                .params({jwt: utils.jwt.admin_refresh, data: device})
                .expectError(401, 'Unauthorized')
                .send(done);
 
        });

        it('should not get information about device without deviceId', function (done) {
            var requestId = getRequestId();

            var expectedDevice = utils.core.clone(device);
            delete expectedDevice.key;

            conn.params({
                    action: 'device/get',
                    requestId: requestId
                })
                .expectError(400, 'Device id is wrong or empty')
                .send(done);
        });

        it('should return 400 when deviceId is null', function (done) {
            var requestId = getRequestId();

            var expectedDevice = utils.core.clone(device);
            delete expectedDevice.key;

            conn.params({
                action: 'device/get',
                requestId: requestId,
                deviceId: null
            })
                .expectError(400, 'Device id is wrong or empty')
                .send(done);
        });

        it('should return 403 when client has no access to device', function (done) {
            var requestId = getRequestId();
            var invalidDeviceId = 'invalid-device-id';

            conn.params({
                action: 'device/get',
                deviceId: invalidDeviceId,
                requestId: requestId
            })
                .expectError(403, 'Access is denied')
                .send(done);
        });

        it('should return 404 for admin when no device exists', function (done) {
            var requestId = getRequestId();
            var invalidDeviceId = 'invalid-device-id';

            adminConn.params({
                action: 'device/get',
                deviceId: invalidDeviceId,
                requestId: requestId
            })
                .expectError(404, 'Device with such deviceId = ' + invalidDeviceId + ' not found')
                .send(done);
        });

        after(function (done) {
            conn.close();
            adminConn.close();
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

            function createDevice2(callback) {
                device2.networkId = networkId;
                req.update(path.get(path.DEVICE, deviceId2))
                    .params({jwt: utils.jwt.admin, data: device2})
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
                    deviceIds: [deviceId, deviceId2],
                    networkIds: [networkId],
                    deviceTypeIds: void 0
                };
                utils.jwt.create(utils.admin.id, args.actions, args.networkIds, args.deviceTypeIds, function (err, result) {
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
                    token: token
                })
                    .send(callback);
            }

            async.series([
                createNetwork,
                createDevice,
                createDevice2,
                createToken,
                createConn,
                authenticateConn
            ], done);
        });

        it('should count devices based on the name pattern', function (done) {
            var requestId = getRequestId();

            var expectedDevice = utils.core.clone(device);
            delete expectedDevice.key;

            conn.params({
                action: 'device/count',
                requestId: requestId,
                namePattern: '%ws-device-1%'
            })
                .expect({
                    action: 'device/count',
                    requestId: requestId,
                    status: 'success'
                })
                .assert(function (result) {
                    assert.strictEqual(result.count, 1);
                })
                .send(done);
        });

        it('should get the first device only', function (done) {
            var requestId = getRequestId();

            var expectedDevice = utils.core.clone(device);
            delete expectedDevice.key;

            conn.params({
                action: 'device/list',
                requestId: requestId,
                namePattern: '%ws-device-1%'
            })
                .expect({
                    action: 'device/list',
                    requestId: requestId,
                    status: 'success',
                    devices: [expectedDevice]
                })
                .send(done);
        });

        it('should get device count', function (done) {
            var requestId = getRequestId();

            var expectedDevice = utils.core.clone(device);
            var expectedDevice2 = utils.core.clone(device2);
            delete expectedDevice.key;
            delete expectedDevice2.key;

            conn.params({
                action: 'device/count',
                requestId: requestId
            })
                .expect({
                    action: 'device/count',
                    requestId: requestId,
                    status: 'success'
                })
                .assert(function (result) {
                    assert.strictEqual(result.count > 0, true);
                })
                .send(done);
        });

        it('should get devices in correct order', function (done) {
            var requestId = getRequestId();

            var expectedDevice = utils.core.clone(device);
            var expectedDevice2 = utils.core.clone(device2);
            delete expectedDevice.key;
            delete expectedDevice2.key;

            conn.params({
                action: 'device/list',
                requestId: requestId,
                sortField: 'name',
                sortOrder: 'asc'
            })
                .expect({
                    action: 'device/list',
                    requestId: requestId,
                    status: 'success',
                    devices: [expectedDevice, expectedDevice2]
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
        var illegalDeviceId1 = 'comma,test';
        var illegalDeviceId2 = '$pecial_symbol&test';
        var illegalDeviceId3 = 'm*!t1s1#bo!_test';

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
        	    device.id = deviceId;
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
                    networkIds: void 0,
                    deviceTypeIds: ['*']
                };
                utils.jwt.create(utils.admin.id, args.actions, args.networkIds, args.deviceTypeIds, function (err, result) {
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

        it('should return error for device id with illegal characters', function(done) {
            var requestId = getRequestId();
            conn.params({
                action: 'device/save',
                requestId: requestId,
                deviceId: illegalDeviceId1
            })
                .expectError(400, 'Device Id can only contain letters, digits and dashes.')
                .send(done);

            requestId = getRequestId();
            conn.params({
                action: 'device/save',
                requestId: requestId,
                deviceId: illegalDeviceId2
            })
                .expectError(400, 'Device Id can only contain letters, digits and dashes.')
                .send(done);

            requestId = getRequestId();
            conn.params({
                action: 'device/save',
                requestId: requestId,
                deviceId: illegalDeviceId3
            })
                .expectError(400, 'Device Id can only contain letters, digits and dashes.')
                .send(done);
        });

        after(function (done) {
            conn.close();
            utils.clearDataJWT(done);
        });
    });

    describe('#device/delete', function () {

        var conn = null;
        var refreshConn = null;
        var adminConn = null;
        var networkId = null;

        var DEVICE_TO_DELETE = utils.getName('ws-device');
        var deviceToDelete = {
            name: DEVICE_TO_DELETE,
            data: {a: '111', b: '123'}
        };
        var deviceToDeleteId = utils.getName('ws-device-id');


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
                deviceToDelete.id = deviceToDeleteId;
                deviceToDelete.networkId = networkId;
                req.update(path.get(path.DEVICE, deviceToDeleteId))
                    .params({jwt: utils.jwt.admin, data: deviceToDelete})
                    .send(callback);
            }

            function createConn(callback) {
                conn = new Websocket(url);
                conn.connect(callback);
            }
            
            function createRefreshConn(callback) {
                refreshConn = new Websocket(url);
                refreshConn.connect(callback);
            }

            function createAdminConn(callback) {
                adminConn = new Websocket(url);
                adminConn.connect(callback);
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
                    networkIds: void 0,
                    deviceTypeIds: void 0
                };
                utils.jwt.create(utils.admin.id, args.actions, args.networkIds, args.deviceTypeIds, function (err, result) {
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
                    token: token
                })
                    .send(callback);
            }

            function authenticateAdminConn(callback) {
                adminConn.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: utils.jwt.admin
                })
                    .send(callback);
            }

            async.series([
                createNetwork,
                createDevice,
                createToken,
                createConn,
                createRefreshConn,
                createAdminConn,
                authenticateConn,
                authenticateAdminConn
            ], done);
        });

        
        it('should return error using refresh jwt', function(done) {
            var requestId = getRequestId();

            refreshConn.params({
                action: 'authenticate',
                requestId: getRequestId(),
                token: utils.jwt.admin_refresh
            })
                .expectError(401, 'Invalid credentials')
                .send(done);
        });

        it('should return 403 for invalid device id with client token', function(done) {
            var requestId = getRequestId();
            var deviceToDeleteInvalidId = 'invalid-device-id';
            
            conn.params({
                action: 'device/delete',
                requestId: requestId,
                deviceId: deviceToDeleteInvalidId
            })
                .expectError(403, 'Access is denied')
                .send(done);
        });

        it('should return 404 for invalid device id with admin token', function(done) {
            var requestId = getRequestId();
            var deviceToDeleteInvalidId = 'invalid-device-id';
            
            adminConn.params({
                action: 'device/delete',
                requestId: requestId,
                deviceId: deviceToDeleteInvalidId
            })
                .expectError(404, 'Device with such deviceId = ' + deviceToDeleteInvalidId + ' not found')
                .send(done);
        });
        
        it('should delete device', function (done) {

            function deleteDevice(callback) {
                var requestId = getRequestId();
                adminConn.params({
                    action: 'device/delete',
                    requestId: requestId,
                    deviceId: deviceToDeleteId
                })
                    .expect({
                        action: 'device/delete',
                        requestId: requestId,
                        status: 'success'
                    })
                    .send(callback);
            }

            function checkDevice(callback) {
                var expectedDevice = utils.core.clone(device);
                delete expectedDevice.key;

                req.get(path.DEVICE)
                    .params({jwt: utils.jwt.admin, id: deviceToDeleteId})
                    .expectError(404, 'Device with such deviceId = ' + deviceToDeleteId + ' not found')
                    .send(callback);
            }

            async.series([
                deleteDevice,
                checkDevice
            ], done);
        });

        after(function (done) {
            conn.close();
            adminConn.close();
            utils.clearDataJWT(done);
        });
    });
});
