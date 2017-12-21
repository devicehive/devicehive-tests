var async = require('async');
var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API Device Type', function () {
    this.timeout(90000);
    var url = null;

    var DEVICE_TYPE1 = utils.getName('ws-device-type-1');
    var DEVICE_TYPE2 = utils.getName('ws-device-type-2');
    var token = null;

    var deviceTypeDefault = {
        name: 'Default Device Type',
        id: 1,
        description: 'Default DeviceHive device type'
    };

    before(function (done) {
        req.get(path.INFO).params({jwt: utils.jwt.admin}).send(function (err, result) {
            if (err) {
                return done(err);
            }
            url = result.webSocketServerUrl;
            done();
        });
    });

    describe('#devicetype/get', function () {

        var conn = null;
        var adminConn = null;
        var deviceTypeId = null;

        before(function (done) {
            function createDeviceType(callback) {
                var params = {
                    jwt: utils.jwt.admin,
                    data: { name: DEVICE_TYPE1 }
                };

                utils.create(path.DEVICE_TYPE, params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    deviceTypeId = result.id;
                    callback();
                });
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
                        'GetDeviceType',
                        'ManageDeviceType'
                    ],
                    deviceTypeIds: deviceTypeId
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
                createDeviceType,
                createToken,
                createConn,
                createAdminConn,
                authenticateConn,
                authenticateAdminConn
            ], done);
        });

        it('should not get information about device type without id', function (done) {
            var requestId = getRequestId();

            conn.params({
                action: 'devicetype/get',
                requestId: requestId
            })
                .expectError(400, 'Device type id is wrong or empty')
                .send(done);
        });

        it('should return 400 when id is null', function (done) {
            var requestId = getRequestId();

            conn.params({
                action: 'devicetype/get',
                requestId: requestId,
                id: null
            })
                .expectError(400, 'Device type id is wrong or empty')
                .send(done);
        });

        it('should return 404 when no device type exists with client token', function (done) {
            var requestId = getRequestId();

            conn.params({
                action: 'devicetype/get',
                deviceTypeId: utils.NON_EXISTING_ID,
                requestId: requestId
            })
                .expectError(404, 'Device type with id = ' + utils.NON_EXISTING_ID + ' not found')
                .send(done);
        });

        it('should return 404 when no device type exists with admin token', function (done) {
            var requestId = getRequestId();

            adminConn.params({
                action: 'devicetype/get',
                deviceTypeId: utils.NON_EXISTING_ID,
                requestId: requestId
            })
                .expectError(404, 'Device type with id = ' + utils.NON_EXISTING_ID + ' not found')
                .send(done);
        });

        after(function (done) {
            conn.close();
            utils.clearDataJWT(done);
        });
    });

    describe('#devicetype/list', function () {

        var conn = null;
        var deviceTypeId1 = null;
        var deviceTypeId2 = null;

        before(function (done) {
            function createDeviceType1(callback) {
                var params = {
                    jwt: utils.jwt.admin,
                    data: { name: DEVICE_TYPE1 }
                };

                utils.create(path.DEVICE_TYPE, params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    deviceTypeId1 = result.id;
                    callback();
                });
            }

            function createDeviceType2(callback) {
                var params = {
                    jwt: utils.jwt.admin,
                    data: { name: DEVICE_TYPE2 }
                };

                utils.create(path.DEVICE_TYPE, params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    deviceTypeId2 = result.id;
                    callback();
                });
            }

            function createConn(callback) {
                conn = new Websocket(url);
                conn.connect(callback);
            }

            function createToken(callback) {
                var args = {
                    actions: [
                        'GetDeviceType',
                        'ManageDeviceType'
                    ],
                    deviceTypeIds: [deviceTypeId1, deviceTypeId2]
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
                createDeviceType1,
                createDeviceType2,
                createToken,
                createConn,
                authenticateConn
            ], done);
        });

        it('should get the first device type only', function (done) {
            var requestId = getRequestId();

            var expectedDeviceType = {
                name: DEVICE_TYPE1,
                id: deviceTypeId1,
                description: null
            };

            conn.params({
                action: 'devicetype/list',
                requestId: requestId,
                namePattern: '%ws-device-type-1%'
            })
                .expect({
                    action: 'devicetype/list',
                    requestId: requestId,
                    status: 'success',
                    deviceTypes: [expectedDeviceType]
                })
                .send(done);
        });

        it('should get device types in correct ASC order', function (done) {
            var requestId = getRequestId();

            var expectedDeviceType1 = {
                name: DEVICE_TYPE1,
                id: deviceTypeId1,
                description: null
            };
            var expectedDeviceType2 = {
                name: DEVICE_TYPE2,
                id: deviceTypeId2,
                description: null
            };

            conn.params({
                action: 'devicetype/list',
                requestId: requestId,
                sortField: 'name',
                sortOrder: 'ASC'
            })
                .expect({
                    action: 'devicetype/list',
                    requestId: requestId,
                    status: 'success',
                    deviceTypes: [deviceTypeDefault, expectedDeviceType1, expectedDeviceType2]
                })
                .send(done);
        });

        it('should get device types in correct DESC order', function (done) {
            var requestId = getRequestId();

            var expectedDeviceType1 = {
                name: DEVICE_TYPE1,
                id: deviceTypeId1,
                description: null
            };
            var expectedDeviceType2 = {
                name: DEVICE_TYPE2,
                id: deviceTypeId2,
                description: null
            };

            conn.params({
                action: 'devicetype/list',
                requestId: requestId,
                sortField: 'name',
                sortOrder: 'DESC'
            })
                .expect({
                    action: 'devicetype/list',
                    requestId: requestId,
                    status: 'success',
                    deviceTypes: [expectedDeviceType2, expectedDeviceType1, deviceTypeDefault]
                })
                .send(done);
        });


        after(function (done) {
            conn.close();
            utils.clearDataJWT(done);
        });
    });

    describe('#devicetype/insert', function () {

        var conn = null;

        before(function (done) {
            function createConn(callback) {
                conn = new Websocket(url);
                conn.connect(callback);
            }

            function createToken(callback) {
                var args = {
                    actions: [
                        'GetDeviceType',
                        'ManageDeviceType'
                    ]
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
                createToken,
                createConn,
                authenticateConn
            ], done);
        });

        it('should insert device type', function (done) {
            var requestId = getRequestId();

            conn.params({
                action: 'devicetype/insert',
                requestId: requestId,
                deviceType: { name: DEVICE_TYPE1 }
            })
                .expect({
                    action: 'devicetype/insert',
                    requestId: requestId,
                    status: 'success'
                })
                .send(done);
        });

        after(function (done) {
            conn.close();
            utils.clearDataJWT(done);
        });
    });

    describe('#devicetype/update', function () {

        var conn = null;
        var adminConn = null;

        before(function (done) {
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
                        'GetDeviceType',
                        'ManageDeviceType'
                    ]
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
                createToken,
                createConn,
                createAdminConn,
                authenticateConn,
                authenticateAdminConn
            ], done);
        });

        it('should return error for invalid device type id with client token', function(done) {
            var requestId = getRequestId();

            conn.params({
                action: 'devicetype/delete',
                requestId: requestId,
                deviceTypeId: utils.NON_EXISTING_ID,
                deviceType: DEVICE_TYPE1
            })
                .expectError(404, 'Device type with id = ' + utils.NON_EXISTING_ID + ' not found')
                .send(done);
        });

        it('should return error for invalid device type id with admin token', function(done) {
            var requestId = getRequestId();
            var deviceTypeId = utils.NON_EXISTING_ID;

            adminConn.params({
                action: 'devicetype/delete',
                requestId: requestId,
                deviceTypeId: deviceTypeId,
                deviceType: DEVICE_TYPE1
            })
                .expectError(404, 'Device type with id = ' + deviceTypeId + ' not found')
                .send(done);
        });

        it('should update device type', function (done) {
            var requestId = getRequestId();

            adminConn.params({
                action: 'devicetype/insert',
                requestId: requestId,
                deviceType: { name: DEVICE_TYPE1 }
            })
                .expect({
                    action: 'devicetype/insert',
                    requestId: requestId,
                    status: 'success'
                })
                .send(deviceTypeUpdate);

            function deviceTypeUpdate(err, result) {
                if (err) {
                    return done(err);
                }

                var requestId = getRequestId();
                this.deviceTypeId = result.deviceType.id;
                var DEVICE_TYPE1_UPDATE = utils.getName('ws-device-type-1');
                adminConn.params({
                    action: 'devicetype/update',
                    requestId: requestId,
                    deviceTypeId: this.deviceTypeId,
                    deviceType: { name: DEVICE_TYPE1_UPDATE }
                })
                    .expect({
                        action: 'devicetype/update',
                        status: 'success',
                        requestId: requestId
                    })
                    .send(checkDeviceTypeUpdate);
            };

            function checkDeviceTypeUpdate(err, result) {
                if (err) {
                    return done(err);
                }

                var requestId = getRequestId();
                adminConn.params({
                    action: 'devicetype/get',
                    requestId: requestId,
                    deviceTypeId: this.deviceTypeId
                })
                    .expect({
                        action: 'devicetype/get',
                        status: 'success',
                        requestId: requestId
                    })
                    .send(done);
            };
        });

        after(function (done) {
            conn.close();
            adminConn.close();
            utils.clearDataJWT(done);
        });
    });

    describe('#devicetype/delete', function () {

        var conn = null;
        var adminConn = null;
        var deviceTypeId = null;

        before(function (done) {
            function createDeviceType(callback) {
                var params = {
                    jwt: utils.jwt.admin,
                    data: { name: DEVICE_TYPE1 }
                };

                utils.create(path.DEVICE_TYPE, params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    deviceTypeId = result.id;
                    callback();
                });
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
                        'GetDeviceType',
                        'ManageDeviceType'
                    ],
                    deviceTypeIds: deviceTypeId
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
                createDeviceType,
                createToken,
                createConn,
                createAdminConn,
                authenticateConn,
                authenticateAdminConn
            ], done);
        });

        it('should return error for invalid device type id with client token', function(done) {
            var requestId = getRequestId();

            conn.params({
                action: 'devicetype/delete',
                requestId: requestId,
                deviceTypeId: utils.NON_EXISTING_ID
            })
                .expectError(404, 'Device type with id = ' + utils.NON_EXISTING_ID + ' not found')
                .send(done);
        });

        it('should return error for invalid device type id with admin token', function(done) {
            var requestId = getRequestId();
            var deviceTypeId = utils.NON_EXISTING_ID;

            adminConn.params({
                action: 'devicetype/delete',
                requestId: requestId,
                deviceTypeId: deviceTypeId
            })
                .expectError(404, 'Device type with id = ' + deviceTypeId + ' not found')
                .send(done);
        });

        it('should delete device type', function (done) {

            function deleteDeviceType(callback) {
                var requestId = getRequestId();
                conn.params({
                    action: 'devicetype/delete',
                    requestId: requestId,
                    deviceTypeId: deviceTypeId
                })
                    .expect({
                        action: 'devicetype/delete',
                        requestId: requestId,
                        status: 'success'
                    })
                    .send(callback);
            }

            function checkDeviceType(callback) {
                req.get(path.DEVICE_TYPE)
                    .params({jwt: utils.jwt.admin, id: deviceTypeId})
                    .expectError(404, 'Device type with id = ' + deviceTypeId + ' not found')
                    .send(callback);
            }

            async.series([
                deleteDeviceType,
                checkDeviceType
            ], done);
        });

        after(function (done) {
            conn.close();
            utils.clearDataJWT(done);
        });
    });
});

