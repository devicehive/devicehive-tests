var assert = require('assert');
var async = require('async');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;

describe('REST API Device Equipment', function () {
    this.timeout(30000);

    var DEVICE_GUID = utils.getName('device-guid-12345');
    var EQUIPMENT = utils.getName('device-eqpmnt');
    var networkId = null;
    var equipment = {equipment: EQUIPMENT, a: 'some value'};
    var deviceClassId = null;
    var timestamp = null;

    before(function (done) {
        path.current = path.combine(path.DEVICE, DEVICE_GUID, 'equipment');

        var NETWORK = utils.getName('network-device-eqpmnt');
        var DEVICE = utils.getName('device-eqpmnt');

        function createNetwork(callback) {
            var params = {
                user: utils.admin,
                data: {
                    name: NETWORK
                }
            };

            utils.create(path.NETWORK, params, function (err, result) {
                if (err) {
                    return callback(err);
                }

                networkId = result.id;
                callback()
            });
        }

        function createDeviceClass(callback) {
            var params = utils.deviceClass.getParamsObj(DEVICE, utils.admin, '1');
            utils.create(path.DEVICE_CLASS, params, function (err, result) {
                if (err) {
                    return callback(err);
                }

                deviceClassId = result.id;
                callback();
            });
        }

        function createDevice(callback) {
            var params = utils.device.getParamsObj(DEVICE, utils.admin,
                {name: NETWORK}, {name: DEVICE, version: '1'});
            params.id = DEVICE_GUID;
            utils.update(path.DEVICE, params, function (err) {
                callback(err);
            });
        }

        function createNotification(callback) {
            var params = utils.notification.getParamsObj('equipment', utils.admin, equipment);
            utils.create(path.NOTIFICATION.get(DEVICE_GUID), params, function (err, result) {
                if (err) {
                    return callback(err);
                }

                timestamp = result.timestamp;
                callback();
            });
        }

        async.series([
            createNetwork,
            createDeviceClass,
            createDevice,
            createNotification
        ], done);
    });

    describe('#Get All', function () {

        var user1 = null;
        var user2 = null;

        before(function (done) {
            utils.createUser2(1, void 0, function (err, result) {
                if (err) {
                    return done(err);
                }

                user1 = result.user;

                utils.createUser2(1, networkId, function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    user2 = result.user;
                    done();
                });
            });
        });

        it('should return error when wrong user tries to get equipment', function (done) {
            utils.get(path.current, {user: user1}, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error,
                    format('Device with such guid = %s not found', DEVICE_GUID));
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);
                done();
            });
        });

        it('should not fail when allowed user tries to get equipment', function (done) {
            utils.get(path.current, {user: user2}, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true, 'Is array of 1 object');
                utils.matches(result[0], {
                    id: equipment.equipment,
                    parameters: {a: equipment.a}
                });
                assert.strictEqual(new Date(result[0].timestamp).toUTCString(),
                    new Date(timestamp).toUTCString());
                done();
            });
        });

        it('should fail with 404 when using access key related to wrong user', function (done) {
            utils.accessKey.create(user1, void 0, 'GetDeviceState', void 0, void 0,
                function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    utils.get(path.current, {accessKey: result.key}, function (err) {
                        assert.strictEqual(!(!err), true, 'Error object created');
                        assert.strictEqual(err.error,
                            format('Device with such guid = %s not found', DEVICE_GUID));
                        assert.strictEqual(err.httpStatus, status.NOT_FOUND);
                        done();
                    });
                });
        });

        it('should fail with 404 when using access key related to wrong network', function (done) {
            utils.accessKey.create(user2, void 0, 'GetDeviceState', void 0, '1',
                function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    utils.get(path.current, {accessKey: result.key}, function (err) {
                        assert.strictEqual(!(!err), true, 'Error object created');
                        assert.strictEqual(err.error,
                            format('Device with such guid = %s not found', DEVICE_GUID));
                        assert.strictEqual(err.httpStatus, status.NOT_FOUND);
                        done();
                    });
                });
        });

        it('should fail with 404 when using access key related to wrong deviceGuid', function (done) {
            utils.accessKey.create(user2, void 0, 'GetDeviceState', 'DEVICE-' + +new Date(), void 0,
                function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    utils.get(path.current, {accessKey: result.key}, function (err) {
                        assert.strictEqual(!(!err), true, 'Error object created');
                        assert.strictEqual(err.error,
                            format('Device with such guid = %s not found', DEVICE_GUID));
                        assert.strictEqual(err.httpStatus, status.NOT_FOUND);
                        done();
                    });
                });
        });

        it('should succeed when using valid user access key', function (done) {
            utils.accessKey.create(user2, void 0, 'GetDeviceState', void 0, void 0,
                function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    utils.get(path.current, {accessKey: result.key}, function (err, result) {
                        assert.strictEqual(!(!err), false, 'No error');
                        assert.strictEqual(!(!result), true, 'Has result');
                        done();
                    });
                });
        })
    });

    describe('#Create/Update/Delete', function () {

        var params = {
            user: utils.admin,
            data: {
                parameters: {
                    x: 'y'
                }
            }
        };

        it('should fail with 405 when trying to create', function (done) {
            utils.create(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'HTTP 405 Method Not Allowed');
                assert.strictEqual(err.httpStatus, status.METHOD_NOT_ALLOWED);
                done();
            })
        });

        it('should fail with 405 when trying to update', function (done) {
            params.id = EQUIPMENT;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'HTTP 405 Method Not Allowed');
                assert.strictEqual(err.httpStatus, status.METHOD_NOT_ALLOWED);
                done();
            })
        });

        it('should fail with 405 when trying to delete', function (done) {
            params.id = EQUIPMENT;
            utils.delete(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'HTTP 405 Method Not Allowed');
                assert.strictEqual(err.httpStatus, status.METHOD_NOT_ALLOWED);
                done();
            });
        });
    });

    describe('#Unauthorized', function () {
        it('should fail when request Unauthorized', function () {
            utils.get(path.current, {}, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Unauthorized');
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
            })
        });

        it('should fail when request Unauthorized', function () {
            var $path = path.combine(path.DEVICE, 'none', 'equipment');
            utils.get($path, {}, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Unauthorized');
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
            })
        });
    });

    describe('#Not Found', function () {
        it('should fail when no equipment was found', function () {
            var $path = path.combine(path.DEVICE, 'none', 'equipment');
            utils.get($path, {user: utils.admin}, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error,
                    format('Device with such guid = %s not found', 'none'));
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);
            })
        });
    });

    after(function (done) {
        utils.clearData(done);
    })
});