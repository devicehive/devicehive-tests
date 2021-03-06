var async = require('async');
var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var status = require('./common/http').status;
var Websocket = require('./common/ws');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API Device Type', function () {
    this.timeout(90000);
    var url = null;

    var DEVICE_TYPE1 = utils.getName('ws-device-type-1');
    var DEVICE_TYPE2 = utils.getName('ws-device-type-2');
    var token = null;
    var noActionsToken = null;

    before(function (done) {
        req.get(path.INFO).params({ jwt: utils.jwt.admin }).send(function (err, result) {
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
                conn.on({
                    action: 'authenticate',
                    status: 'success'
                }, callback);

                conn.send({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: token
                });
            }

            function authenticateAdminConn(callback) {
                adminConn.on({
                    action: 'authenticate',
                    status: 'success'
                }, callback);

                adminConn.send({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: utils.jwt.admin
                });
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

            conn.on({
                code: 400,
                error: 'Device type id is wrong or empty'
            }, done);

            conn.send({
                action: 'devicetype/get',
                requestId: requestId
            });
        });

        it('should return 400 when id is null', function (done) {
            var requestId = getRequestId();

            conn.on({
                code: 400,
                error: 'Device type id is wrong or empty'
            }, done);

            conn.send({
                action: 'devicetype/get',
                requestId: requestId,
                id: null
            });
        });

        it('should return 404 when no device type exists with client token', function (done) {
            var requestId = getRequestId();

            conn.on({
                code: 404,
                error: 'Device type with id = ' + utils.NON_EXISTING_ID + ' not found'
            }, done);

            conn.send({
                action: 'devicetype/get',
                deviceTypeId: utils.NON_EXISTING_ID,
                requestId: requestId
            });
        });

        it('should return 404 when no device type exists with admin token', function (done) {
            var requestId = getRequestId();

            adminConn.on({
                code: 404,
                error: 'Device type with id = ' + utils.NON_EXISTING_ID + ' not found'
            }, done);

            adminConn.send({
                action: 'devicetype/get',
                deviceTypeId: utils.NON_EXISTING_ID,
                requestId: requestId
            });
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
        var noActionsConnection = null;

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

            function createNoActionsConnection(callback) {
                noActionsConnection = new Websocket(url);
                noActionsConnection.connect(callback);
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


            function createNoActionsToken(callback) {
                var args = {
                    actions: void 0,
                    networkIds: void 0,
                    deviceTypeIds: [deviceTypeId1, deviceTypeId2]
                };
                utils.jwt.create(utils.admin.id, args.actions, args.networkIds, args.deviceTypeIds, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    noActionsToken = result.accessToken;
                    callback()
                })
            }

            function authenticateConn(callback) {
                conn.on({
                    action: 'authenticate',
                    status: 'success'
                }, callback);

                conn.send({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: token
                });
            }

            function authenticateNoActionsConnection(callback) {

                noActionsConnection.on({
                    action: 'authenticate',
                    status: 'success'
                }, callback);

                noActionsConnection.send({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: noActionsToken
                });
            }

            async.series([
                createDeviceType1,
                createDeviceType2,
                createToken,
                createNoActionsToken,
                createConn,
                createNoActionsConnection,
                authenticateConn,
                authenticateNoActionsConnection
            ], done);
        });

        it('should count device types based on the name pattern', function (done) {
            var requestId = getRequestId();

            conn.on({
                action: 'devicetype/count',
                requestId: requestId,
                status: 'success',
                count: 1
            }, done);

            conn.send({
                action: 'devicetype/count',
                requestId: requestId,
                namePattern: '%ws-device-type-1%'
            });
        });

        it('should get the first device type only', function (done) {
            var requestId = getRequestId();

            var expectedDeviceType = {
                name: DEVICE_TYPE1,
                id: deviceTypeId1,
                description: null
            };

            conn.on({
                action: 'devicetype/list',
                requestId: requestId,
                status: 'success',
                deviceTypes: [expectedDeviceType]
            }, done);

            conn.send({
                action: 'devicetype/list',
                requestId: requestId,
                namePattern: '%ws-device-type-1%'
            });
        });

        it('should get device type count', function (done) {
            var requestId = getRequestId();

            conn.on({
                action: 'devicetype/count',
                requestId: requestId,
                status: 'success'
            }, (err, data) => {
                assert.strictEqual(data.count > 0, true);
                done();
            });

            conn.send({
                action: 'devicetype/count',
                namePattern: '%ws-device-type%',
                requestId: requestId
            });
        });

        it('should fail with 403 on count all device types', function (done) {
            var requestId = getRequestId();

            noActionsConnection.on({
                code: status.FORBIDDEN
            }, done);

            noActionsConnection.send({
                action: 'devicetype/count',
                requestId: requestId
            });
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

            conn.on({
                action: 'devicetype/list',
                requestId: requestId,
                status: 'success',
                deviceTypes: [expectedDeviceType1, expectedDeviceType2]
            }, done);

            conn.send({
                action: 'devicetype/list',
                namePattern: '%ws-device-type%',
                requestId: requestId,
                sortField: 'name',
                sortOrder: 'ASC'
            });
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

            conn.on({
                action: 'devicetype/list',
                requestId: requestId,
                status: 'success',
                deviceTypes: [expectedDeviceType2, expectedDeviceType1]
            }, done);

            conn.send({
                action: 'devicetype/list',
                namePattern: '%ws-device-type%',
                requestId: requestId,
                sortField: 'name',
                sortOrder: 'DESC'
            });
        });


        after(function (done) {
            conn.close();
            noActionsConnection.close();
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
                conn.on({
                    action: 'authenticate',
                    status: 'success'
                }, callback);

                conn.send({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: token
                });
            }

            async.series([
                createToken,
                createConn,
                authenticateConn
            ], done);
        });

        it('should insert device type', function (done) {
            var requestId = getRequestId();

            conn.on({
                action: 'devicetype/insert',
                requestId: requestId,
                status: 'success'
            }, done);

            conn.send({
                action: 'devicetype/insert',
                requestId: requestId,
                deviceType: { name: DEVICE_TYPE1 }
            });
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
                conn.on({
                    action: 'authenticate',
                    status: 'success'
                }, callback);

                conn.send({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: token
                });
            }

            function authenticateAdminConn(callback) {
                adminConn.on({
                    action: 'authenticate',
                    status: 'success'
                }, callback);

                adminConn.send({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: utils.jwt.admin
                });
            }

            async.series([
                createToken,
                createConn,
                createAdminConn,
                authenticateConn,
                authenticateAdminConn
            ], done);
        });

        it('should return error for invalid device type id with client token', function (done) {
            var requestId = getRequestId();

            conn.on({
                code: 404,
                error: 'Device type with id = ' + utils.NON_EXISTING_ID + ' not found'
            }, done);

            conn.send({
                action: 'devicetype/update',
                requestId: requestId,
                deviceTypeId: utils.NON_EXISTING_ID
            });
        });

        it('should return error for invalid device type id with admin token', function (done) {
            var requestId = getRequestId();
            var deviceTypeId = utils.NON_EXISTING_ID;

            adminConn.on({
                code: 404,
                error: 'Device type with id = ' + utils.NON_EXISTING_ID + ' not found'
            }, done);

            adminConn.send({
                action: 'devicetype/update',
                requestId: requestId,
                deviceTypeId: deviceTypeId
            });
        });

        it('should update device type', function (done) {
            var requestId = getRequestId();

            adminConn.on({
                action: 'devicetype/insert',
                requestId: requestId,
                status: 'success'
            }, deviceTypeUpdate);

            adminConn.send({
                action: 'devicetype/insert',
                requestId: requestId,
                deviceType: { name: DEVICE_TYPE1 }
            });

            function deviceTypeUpdate(err, result) {
                if (err) {
                    return done(err);
                }

                var requestId = getRequestId();
                this.deviceTypeId = result.deviceType.id;
                var DEVICE_TYPE1_UPDATE = utils.getName('ws-device-type-1');

                adminConn.on({
                    action: 'devicetype/update',
                    status: 'success',
                    requestId: requestId
                }, checkDeviceTypeUpdate);
    
                adminConn.send({
                    action: 'devicetype/update',
                    requestId: requestId,
                    deviceTypeId: this.deviceTypeId,
                    deviceType: { name: DEVICE_TYPE1_UPDATE }
                });
            };

            function checkDeviceTypeUpdate(err, result) {
                if (err) {
                    return done(err);
                }

                var requestId = getRequestId();

                adminConn.on({
                    action: 'devicetype/get',
                    status: 'success',
                    requestId: requestId
                }, done);
    
                adminConn.send({
                    action: 'devicetype/get',
                    requestId: requestId,
                    deviceTypeId: this.deviceTypeId
                });
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
                conn.on({
                    action: 'authenticate',
                    status: 'success'
                }, callback);

                conn.send({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: token
                });
            }

            function authenticateAdminConn(callback) {
                adminConn.on({
                    action: 'authenticate',
                    status: 'success'
                }, callback);

                adminConn.send({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: utils.jwt.admin
                });
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

        it('should return error for invalid device type id with client token', function (done) {
            var requestId = getRequestId();

            conn.on({
                code: 404,
                error: 'Device type with id = ' + utils.NON_EXISTING_ID + ' not found'
            }, done);

            conn.send({
                action: 'devicetype/delete',
                requestId: requestId,
                deviceTypeId: utils.NON_EXISTING_ID
            });
        });

        it('should return error for invalid device type id with admin token', function (done) {
            var requestId = getRequestId();
            var deviceTypeId = utils.NON_EXISTING_ID;

            conn.on({
                code: 404,
                error: 'Device type with id = ' + utils.NON_EXISTING_ID + ' not found'
            }, done);

            conn.send({
                action: 'devicetype/delete',
                requestId: requestId,
                deviceTypeId: deviceTypeId
            });
        });

        it('should delete device type', function (done) {

            function deleteDeviceType(callback) {
                var requestId = getRequestId();

                conn.on({
                    action: 'devicetype/delete',
                    requestId: requestId,
                    status: 'success'
                }, callback);
    
                conn.send({
                    action: 'devicetype/delete',
                    requestId: requestId,
                    deviceTypeId: deviceTypeId
                });
            }

            function checkDeviceType(callback) {
                req.get(path.DEVICE_TYPE)
                    .params({ jwt: utils.jwt.admin, id: deviceTypeId })
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

