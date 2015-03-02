var assert = require('assert');
var async = require('async');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;
var consts = require('./common/consts');

describe('REST API Device Class', function () {

    var helper = utils.deviceClass;

    describe('#GetAll', function () {

        var DEVICE_CLASS = '_integr-test-device-class';

        before(function (done) {
            var params = helper.getParams(DEVICE_CLASS, utils.admin, '1');
            utils.create(path.DEVICE_CLASS, params, function (err, result) {
                done(err);
            })
        })

        it('should get when using admin authorization', function (done) {
            utils.get(path.DEVICE_CLASS, {user: utils.admin}, function (err, result) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(utils.core.isArrayNonEmpty(result), true);

                function hasDeviceClass(item) {
                    return item.name === DEVICE_CLASS;
                }
                assert.strictEqual(result.some(hasDeviceClass), true);

                done();
            })
        })
    })

    describe('#Get for User', function () {

        var DEVICE_CLASS = '_integr-test-device-class-1';
        var VERSION = '1';
        var user = null;
        var deviceClassId = null;

        before(function (done) {

            function createUser(callback) {
                utils.createUser2(1, void 0, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    user = result.user;
                    callback();
                })
            }

            function createDeviceClass(callback) {
                var params = helper.getParams(DEVICE_CLASS, utils.admin, VERSION);
                utils.create(path.DEVICE_CLASS, params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    deviceClassId = result.id;
                    callback();
                })
            }

            async.series([
                createUser,
                createDeviceClass,
            ], done);
        })

        it('should get device class for user', function (done) {
            var params = {user: user, id: deviceClassId};
            utils.get(path.DEVICE_CLASS, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(result.name, DEVICE_CLASS);
                assert.strictEqual(result.version, VERSION);

                done();
            })
        })

        it.skip('should allow access key authorization', function (done) {
            var expDate = new Date();
            expDate.setFullYear(expDate.getFullYear() + 10);
            var params = utils.accessKey.getParamsObj(
                '_integr-test-device-class-access-key', user, expDate, void 0, void 0, ['GetDevice']);
            utils.create(path.CURRENT_ACCESS_KEY, params, function (err, result) {
                if (err) {
                    return done(err);
                }

                var params = {accessKey: result.key, id: deviceClassId};
                utils.get(path.DEVICE_CLASS, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    assert.strictEqual(result.name, DEVICE_CLASS);
                    assert.strictEqual(result.version, VERSION);
                    done();
                })
            })
        })
    })

    describe('#Create', function () {

        it('should create device class with user credentials', function (done) {
            var DEVICE_CLASS = '_integr-test-device-class-2';
            var VERSION = '1';

            var params = helper.getParams(DEVICE_CLASS, utils.admin, VERSION);
            utils.create(path.DEVICE_CLASS, params, function (err, result) {
                if (err) {
                    return done(err);
                }

                var params = {user: utils.admin, id: result.id};
                utils.get(path.DEVICE_CLASS, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    assert.strictEqual(result.name, DEVICE_CLASS);
                    assert.strictEqual(result.version, VERSION);
                    done();
                })
            })
        })

        it('should return error when trying to create existing device class', function (done) {
            var DEVICE_CLASS = '_integr-test-device-class-3';
            var VERSION = '1';

            var params = helper.getParams(DEVICE_CLASS, utils.admin, VERSION);
            utils.create(path.DEVICE_CLASS, params, function (err) {
                if (err) {
                    return done(err);
                }

                var params = helper.getParams(DEVICE_CLASS, utils.admin, VERSION);
                utils.create(path.DEVICE_CLASS, params, function (err, result) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'DeviceHive server error - DeviceClass cannot be created. Device class with such name and version already exists');
                    assert.strictEqual(err.httpStatus, status.FORBIDDEN);
                    done();
                })
            })
        })

        it('should return bad request', function (done) {
            var params = {
                user: utils.admin,
                data: {
                    name: '_integr-test-device-class-bad-request'
                }
            };
            utils.create(path.DEVICE_CLASS, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.httpStatus, status.BAD_REQUEST);
                done();
            })
        })
    })

    describe('#Update', function () {

        var deviceClassId = null;

        before(function (done) {
            var params = helper.getParamsObj('_integr-test-device-class-4', utils.admin, '1');
            utils.create(path.DEVICE_CLASS, params, function (err, result) {
                if (err) {
                    return done(err);
                }

                deviceClassId = result.id;
                done();
            })
        })

        it('should update using admin authorization', function (done) {
            var params = helper.getParamsObj('_integr-test-device-class-4-upd-1', utils.admin, '2', true, 3600,
                {
                    name: '_integr-tests-eqpmnt-1',
                    type: '_integr-tests-type-1',
                    code: '_integr-tests-code-1'
                }, { a: 'b' });
            params.id = deviceClassId;
            var update = params.data;

            utils.update(path.DEVICE_CLASS, params, function (err, result) {
                if (err) {
                    return done(err);
                }

                var params = {user: utils.admin, id: deviceClassId};
                utils.get(path.DEVICE_CLASS, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    assert.strictEqual(result.name, update.name);
                    assert.strictEqual(result.version, update.version);
                    assert.strictEqual(result.isPermanent, update.isPermanent);
                    assert.strictEqual(result.offlineTimeout, update.offlineTimeout);
                    assert.strictEqual(utils.core.isArrayOfLength(result.equipment, 1), true, 'Is array of 1 object');
                    assert.strictEqual(result.equipment[0].name, update.equipment[0].name);
                    assert.strictEqual(result.equipment[0].type, update.equipment[0].type);
                    assert.strictEqual(result.equipment[0].code, update.equipment[0].code);
                    assert.deepEqual(result.data, update.data);
                    done();
                })
            });
        })

        it('should partially update using admin authorization', function (done) {

            var params = helper.getParamsObj('_integr-test-device-class-4-upd-2', utils.admin, '3', false);
            params.id = deviceClassId;
            var update = params.data;

            utils.update(path.DEVICE_CLASS, params, function (err) {
                if (err) {
                    return done(err);
                }

                var params = {user: utils.admin, id: deviceClassId};
                utils.get(path.DEVICE_CLASS, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    assert.strictEqual(result.name, update.name);
                    assert.strictEqual(result.version, update.version);
                    assert.strictEqual(result.isPermanent, update.isPermanent);
                    done();
                })
            });
        })
    })

    describe('#Delete', function () {
        it('should delete device class using admin authorization', function (done) {
            var params = helper.getParamsObj('_integr-test-device-class-5', utils.admin, '1');
            utils.create(path.DEVICE_CLASS, params, function (err, result) {
                if (err) {
                    return done(err);
                }

                var deviceClassId = result.id;
                var params = {user: utils.admin, id: deviceClassId};
                utils.delete(path.DEVICE_CLASS, params, function (err) {
                    assert.strictEqual(!(!err), false, 'No error');

                    utils.get(path.DEVICE_CLASS, params, function (err, result) {
                        assert.strictEqual(!(!err), true, 'Error object created');
                        assert.strictEqual(err.error, format('DeviceHive server error - DeviceClass with id = %d not found', deviceClassId));
                        assert.strictEqual(err.httpStatus, status.NOT_FOUND);
                        done();
                    })
                })
            })
        })
    })

    describe('#Not authorized', function () {

        describe('no authorization', function () {
            it('should return error when accessing device class without authorization', function (done) {
                var params = {user: null};
                utils.get(path.DEVICE_CLASS, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'DeviceHive server error - Not authorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            })

            it('should return error when accessing non-existing device class without authorization', function (done) {
                var params = {user: null, id: consts.NON_EXISTING_ID };
                utils.get(path.DEVICE_CLASS, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'DeviceHive server error - Not authorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            })

            it('should return error when creating device class without authorization', function (done) {
                var params = helper.getParamsObj('_integr-test-create-no-auth', null, '1');
                utils.create(path.DEVICE_CLASS, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'DeviceHive server error - Not authorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            })

            it('should return error when updating non-existing device class without authorization', function (done) {
                var params = helper.getParamsObj('_integr-test-update-non-existing', null, '2');
                params.id = consts.NON_EXISTING_ID;
                utils.update(path.DEVICE_CLASS, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'DeviceHive server error - Not authorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            })

            it('should return error when deleting non-existing device class without authorization', function (done) {
                var params = {user: null, id: consts.NON_EXISTING_ID};
                utils.delete(path.DEVICE_CLASS, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'DeviceHive server error - Not authorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            })
        })

        describe('another user authorization', function () {
            var user = null;

            before(function (done) {
                utils.createUser2(1, void 0, function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    user = result.user;
                    done();
                })
            })

            it('should return error when accessing device class with another user', function (done) {
                var params = {user: user};
                utils.get(path.DEVICE_CLASS, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'DeviceHive server error - Not authorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            })

            it('should return error when creating device class using wrong user credentials', function (done) {
                var params = helper.getParamsObj('_integr-test-create-other-user', user);
                utils.create(path.DEVICE_CLASS, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'DeviceHive server error - Not authorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            })

            it('should return error when updating non-existing device class', function (done) {
                var params = helper.getParamsObj('_integr-test-update-non-existing', user, '3');
                params.id = consts.NON_EXISTING_ID;
                utils.update(path.DEVICE_CLASS, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'DeviceHive server error - Not authorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            })

            it('should return error when deleting non-existing device class', function (done) {
                var params = {user: user, id: consts.NON_EXISTING_ID};
                utils.delete(path.DEVICE_CLASS, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'DeviceHive server error - Not authorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            })
        })
    })

    describe('#Not Found', function () {

        it('should return error when accessing non-existing device class', function (done) {
            var params = {user: utils.admin, id: consts.NON_EXISTING_ID };
            utils.get(path.DEVICE_CLASS, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, format('DeviceHive server error - DeviceClass with id = %d not found',
                    consts.NON_EXISTING_ID));
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);
                done();
            })
        })

        it('should return error when updating non-existing device class', function (done) {
            var params = helper.getParamsObj('_integr-test-update-non-existing', utils.admin, '1');
            params.id = consts.NON_EXISTING_ID;
            utils.update(path.DEVICE_CLASS, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, format('DeviceHive server error - DeviceClass with id = %d not found',
                    consts.NON_EXISTING_ID));
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);
                done();
            })
        })

        it('should not return error when deleting non-existing device class', function (done) {
            var params = {user: utils.admin, id: consts.NON_EXISTING_ID};
            utils.delete(path.DEVICE_CLASS, params, function (err) {
                assert.strictEqual(!(!err), false, 'No error');
                done();
            })
        })
    })

    after(function (done) {
        utils.clearResources(done);
    })
});