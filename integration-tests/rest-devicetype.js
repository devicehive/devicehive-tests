var async = require('async');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;
var req = require('./common/request');

describe('REST API DEVICE TYPE', function () {
    this.timeout(90000);

    var DEVICE_TYPE_1 = utils.getName('deviceType-1');
    var DEVICE_TYPE_2 = utils.getName('deviceType-2');
    var deviceTypeId1 = null;
    var deviceTypeId2 = null;
    var user = null;
    var nonTypeUser = null;

    before(function (done) {
        path.current = path.DEVICE_TYPE;

        function createDeviceType1(callback) {
            var params = {
                jwt: utils.jwt.admin,
                data: { name: DEVICE_TYPE_1 }
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
                data: { name: DEVICE_TYPE_2 }
            };

            utils.create(path.DEVICE_TYPE, params, function (err, result) {
                if (err) {
                    return callback(err);
                }

                deviceTypeId2 = result.id;
                callback();
            });
        }

        function createUser(callback) {
            utils.createUser2(1, deviceTypeId1, function (err, result) {
                if (err) {
                    return callback(err);
                }

                user = result.user;
                callback();
            });
        }

        function createNonTypeUser(callback) {
            utils.createUser2(1, void 0, function (err, result) {
                if (err) {
                    return callback(err);
                }

                nonTypeUser = result.user;
                callback();
            });
        }

        async.series([
            createDeviceType1,
            createDeviceType2,
            createUser,
            createNonTypeUser
        ], done);
    });

    describe('#Get All', function () {

        var jwt1 = null;
        var jwt2 = null;
        var jwt3 = null;
        var jwt4 = null;

        before(function (done) {
            var params = [
                {
                    user: user,
                    actions: 'GetDeviceType',
                    deviceTypeIds: ['*']
                },
                {
                    user: user,
                    actions: 'GetDeviceType',
                    deviceTypeIds: [0]
                },
                {
                    user: user,
                    actions: 'GetDeviceType',
                    deviceTypeIds: [deviceTypeId1]
                },
                {
                    user: user,
                    actions: 'GetDeviceType'
                }
            ];

            function createJWTs(callback) {
                utils.jwt.createMany(params, function (err, result) {
                    if (err) {
                        return done(err);
                    }
                    jwt1 = result[0];
                    jwt2 = result[1];
                    jwt3 = result[2];
                    jwt4 = result[3];
                    callback();
                });
            }

            async.series([
                createJWTs
            ], done);
        });

        it('should get all device types for admin jwt', function (done) {
            req.get(path.current)
                .params({jwt: utils.jwt.admin})
                .expectTrue(function (result) {
                    return utils.core.isArrayNonEmpty(result);
                })
                .expectTrue(function (result) {
                    return result.some(function (item) {
                        return item.id === deviceTypeId1;
                    });
                })
                .expectTrue(function (result) {
                    return result.some(function (item) {
                        return item.id === deviceTypeId2;
                    });
                })
                .send(done);
        });

        it('should get device type by name for admin jwt', function (done) {
            req.get(path.current)
                .params({jwt: utils.jwt.admin})
                .query('name', DEVICE_TYPE_1)
                .expect([{id: deviceTypeId1, name: DEVICE_TYPE_1}])
                .send(done);
        });

        it('should get all device types', function (done) {
            req.get(path.current)
                .params({jwt: jwt1})
                .expect([{id: deviceTypeId1, name: DEVICE_TYPE_1}])
                .send(done);
        });

        it('should get none of device types #1', function (done) {
            req.get(path.current)
                .params({jwt: jwt2})
                .expectTrue(function (result) {
                    return utils.core.isEmptyArray(result);
                })
                .send(done);
        });

        it('should get none of device types #2', function (done) {
            req.get(path.current)
                .params({jwt: jwt4})
                .expectTrue(function (result) {
                    return utils.core.isEmptyArray(result);
                })
                .send(done);
        });

        it('should get device type', function (done) {
            req.get(path.current)
                .params({jwt: jwt3})
                .expect([{id: deviceTypeId1, name: DEVICE_TYPE_1}])
                .send(done);
        });
    });

    describe('#Get', function () {

        var jwt1 = null;
        var jwt2 = null;
        var jwt3 = null;
        var jwt4 = null;

        before(function (done) {
            var params = [
                {
                    user: nonTypeUser,
                    actions: 'GetDeviceType'
                },
                {
                    user: user,
                    actions: 'GetDeviceType',
                    deviceTypeIds: [0]
                },
                {
                    user: user,
                    actions: 'GetDeviceType'
                },
                {
                    user: user,
                    actions: 'GetDeviceType',
                    deviceTypeIds: [deviceTypeId1]
                }
            ];

            function createJWTs(callback) {
                utils.jwt.createMany(params, function (err, result) {
                    if (err) {
                        return done(err);
                    }
                    jwt1 = result[0];
                    jwt2 = result[1];
                    jwt3 = result[2];
                    jwt4 = result[3];
                    callback();
                });
            }

            async.series([
                createJWTs
            ], done);
        });

        it('should fail with 403 when getting with non-device type user', function (done) {
            req.get(path.current)
                .params({jwt: jwt1, id: deviceTypeId1})
                .expectError(status.FORBIDDEN, 'Access is denied')
                .send(done);
        });

        it('should fail with 403 #1', function (done) {
            req.get(path.current)
                .params({jwt: jwt1, id: deviceTypeId1})
                .expectError(status.FORBIDDEN, 'Access is denied')
                .send(done);
        });

        it('should fail with 403 #2', function (done) {
            req.get(path.current)
                .params({jwt: jwt2, id: deviceTypeId1})
                .expectError(status.FORBIDDEN, 'Access is denied')
                .send(done);
        });

        it('should succeed when getting device type using valid jwt', function (done) {
            req.get(path.current)
                .params({jwt: jwt4, id: deviceTypeId1})
                .expect({id: deviceTypeId1, name: DEVICE_TYPE_1})
                .send(done);
        });
    });

    describe('#Create', function () {

        it('should create device type using admin jwt', function (done) {
            var deviceType = {name: utils.getName('deviceType-3')};

            req.create(path.current)
                .params({jwt: utils.jwt.admin, data: deviceType})
                .send(function (err, result) {
                    if (err) {
                        done(err);
                    }

                    req.get(path.current)
                        .params({jwt: utils.jwt.admin, id: result.id})
                        .expect(deviceType)
                        .send(done);
                });
        });
    });

    describe('#Create Existing', function () {

        it('should fail with 403 when trying to create existing deviceType', function (done) {
            req.create(path.current)
                .params({jwt: utils.jwt.admin, data: {name: DEVICE_TYPE_1}})
                .expectError(status.FORBIDDEN, 'Device type cannot be created. Device type with such name already exists')
                .send(done);
        });
    });

    describe('#Create Devices', function () {

        var DEVICE = utils.getName('deviceType-device');
        var DEVICE_ID = utils.getName('deviceType-id');

        var jwt1 = null;
        var jwt2 = null;
        var jwt3 = null;
        var jwt4 = null;

        before(function (done) {
            var params = [
                {
                    user: user,
                    actions: 'GetDeviceType'
                },
                {
                    user: user,
                    actions: ['GetDeviceType', 'GetDevice'],
                    deviceIds: utils.NON_EXISTING_ID
                },
                {
                    user: user,
                    actions: ['GetDeviceType', 'GetDevice']
                },
                {
                    user: user,
                    actions: ['GetDeviceType', 'GetDevice'],
                    deviceTypeIds: [deviceTypeId1]
                }
            ];

            function createJWTs(callback) {
                utils.jwt.createMany(params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    jwt1 = result[0];
                    jwt2 = result[1];
                    jwt3 = result[2];
                    jwt4 = result[3];
                    callback();
                });
            }

            function createDevice(callback) {
                req.update(path.get(path.DEVICE, DEVICE_ID))
                    .params(utils.device.getParamsObj(DEVICE, utils.jwt.admin,
                        deviceTypeId1, {name: DEVICE, version: '1'}))
                    .send(function (err) {
                        if (err) {
                            return callback(err);
                        }
                        callback();
                    });
            }

            async.series([
                createJWTs,
                createDevice
            ], done);
        });

        it('should include the list of devices', function (done) {
            req.get(path.get(path.DEVICE_TYPE, deviceTypeId1))
                .params({jwt: utils.jwt.admin})
                .expect({
                    name: DEVICE_TYPE_1,
                    description: null,
                    devices: [{
                        id: DEVICE_ID,
                        name: DEVICE
                    }]
                })
                .send(done);
        });

        it('should return empty devices list result when using jwt1', function (done) {
            req.get(path.get(path.DEVICE_TYPE, deviceTypeId1))
                .params({jwt: jwt1})
                .expectError(status.FORBIDDEN, 'Access is denied')
                .send(done);
        });

        it('should return empty devices list when using jwt2', function (done) {
            req.get(path.get(path.DEVICE_TYPE, deviceTypeId1))
                .params({jwt: jwt2})
                .expectError(status.FORBIDDEN, 'Access is denied')
                .send(done);
        });

        it('should return non-empty devices list when using jwt3', function (done) {
            req.get(path.get(path.DEVICE_TYPE, deviceTypeId1))
                .params({jwt: jwt4})
                .expectTrue(function (result) {
                    return utils.core.isArrayOfLength(result.devices, 1);
                })
                .send(done);
        });
    });

    describe('#Update', function () {

        var deviceTypeId = null;

        before(function (done) {
            req.create(path.current)
                .params({
                    jwt: utils.jwt.admin,
                    data: { name: utils.getName('deviceType-4')}
                })
                .send(function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    deviceTypeId = result.id;
                    done();
                });
        });

        it('should update with admin jwt', function (done) {
            var update = {
                name:utils.getName('deviceType-4-update'),
                description: 'lorem ipsum dolor sit amet'
            };
            req.update(path.current)
                .params({jwt: utils.jwt.admin, id: deviceTypeId, data: update})
                .send(function (err) {
                    if (err) {
                        done(err);
                    }

                    req.get(path.current)
                        .params({jwt: utils.jwt.admin, id: deviceTypeId})
                        .expect(update)
                        .send(done);
                });
        });
    });

    describe('#Update Partial', function () {

        it('should update description with admin jwt', function (done) {
            req.update(path.current)
                .params({jwt: utils.jwt.admin, id: deviceTypeId1, data: {description: 'lorem ipsum dolor sit amet'}})
                .send(function (err) {
                    if (err) {
                        done(err);
                    }

                    req.get(path.current)
                        .params({jwt: utils.jwt.admin, id: deviceTypeId1})
                        .expect({
                            name: DEVICE_TYPE_1,
                            description: 'lorem ipsum dolor sit amet'
                        })
                        .send(done);
                });
        });
    });

    describe('#Delete', function () {

        var deviceTypeId = null;

        before(function (done) {
            req.create(path.current)
                .params({
                    jwt: utils.jwt.admin,
                    data: {name: utils.getName('deviceType-5')}
                })
                .send(function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    deviceTypeId = result.id;
                    done();
                });
        });

        it('should fail get with 404 after we deleted deviceType', function (done) {
            req.delete(path.current)
                .params({jwt: utils.jwt.admin, id: deviceTypeId})
                .send(function (err) {
                    if (err) {
                        return done(err);
                    }

                    req.get(path.current)
                        .params({jwt: utils.jwt.admin, id: deviceTypeId})
                        .expectError(status.NOT_FOUND,
                            format('Device type with id = %s not found', deviceTypeId))
                        .send(done);
                });
        });
    });

    describe('#Bad Request', function () {
        it('should fail with 400 when use invalid request format', function (done) {
            req.create(path.current)
                .params({
                    jwt: utils.jwt.admin,
                    data: {users: 'invalid', invalidProp: utils.getName('deviceType-invalid')}
                })
                .expectError(status.BAD_REQUEST)
                .send(done);
        });
    });

    describe('#Not Authorized', function () {
        describe('#No Authorization', function () {
            it('should fail with 401 if auth parameters omitted', function (done) {
                req.get(path.current)
                    .params({jwt: null})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 if auth parameters omitted', function (done) {
                req.get(path.current)
                    .params({jwt: utils.jwt.admin_refresh})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when selecting device type by id, auth parameters omitted', function (done) {
                req.get(path.current)
                    .params({jwt: null, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when creating device type with no auth parameters', function (done) {
                req.create(path.current)
                    .params({jwt: null, data: {name: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when updating device type with no auth parameters', function (done) {
                req.update(path.current)
                    .params({jwt: null, id: utils.NON_EXISTING_ID, data: {name: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when deleting device type with no auth parameters', function (done) {
                req.delete(path.current)
                    .params({jwt: null, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });
        });

        describe('#Dummy JWT Authorization', function () {

            var jwt = null;

            before(function (done) {
                utils.jwt.create(user.id, user.actions, void 0, void 0, function (err, result) {
                    if (err) {
                        return done(err);
                    }
                    jwt = result.accessToken;
                    done()
                })
            });

            it('should fail with 403 when getting list using invalid access key', function (done) {
                req.get(path.current)
                    .params({jwt: jwt})
                    .expectError(status.FORBIDDEN, 'Access is denied')
                    .send(done);
            });

            it('should fail with 403 when selecting device type by id using invalid access key', function (done) {
                req.get(path.current)
                    .params({jwt: jwt, id: utils.NON_EXISTING_ID})
                    .expectError(status.FORBIDDEN, 'Access is denied')
                    .send(done);
            });

            it('should fail with 403 when creating device type using invalid access key', function (done) {
                req.create(path.current)
                    .params({jwt: jwt, data: {name: 'not-authorized'}})
                    .expectError(status.FORBIDDEN, 'Access is denied')
                    .send(done);
            });

            it('should fail with 403 when updating device type using invalid access key', function (done) {
                req.update(path.current)
                    .params({jwt: jwt, id: utils.NON_EXISTING_ID, data: {name: 'not-authorized'}})
                    .expectError(status.FORBIDDEN, 'Access is denied')
                    .send(done);
            });

            it('should fail with 403 when deleting device type with no auth parameters', function (done) {
                req.delete(path.current)
                    .params({jwt: jwt, id: utils.NON_EXISTING_ID})
                    .expectError(status.FORBIDDEN, 'Access is denied')
                    .send(done);
            });
        });
    });

    describe('#Not Found', function () {

        it('should fail with 404 when selecting device type by non-existing id', function (done) {
            req.get(path.current)
                .params({jwt: utils.jwt.admin, id: utils.NON_EXISTING_ID})
                .expectError(status.NOT_FOUND, format('Device type with id = %s not found', utils.NON_EXISTING_ID))
                .send(done);
        });

        it('should fail with 404 when updating device type by non-existing id', function (done) {
            req.update(path.current)
                .params({jwt: utils.jwt.admin, id: utils.NON_EXISTING_ID})
                .expectError(status.NOT_FOUND, format('Device type with id = %s not found', utils.NON_EXISTING_ID))
                .send(done);
        });

        it('should fail with 404 when deleting device type by non-existing id', function (done) {
            req.delete(path.current)
                .params({jwt: utils.jwt.admin, id: utils.NON_EXISTING_ID})
                .expectError(status.NOT_FOUND, format('Device type with id = %s not found', utils.NON_EXISTING_ID))
                .send(done);
        });
    });

    after(function (done) {
        utils.clearDataJWT(done);
    });
});
