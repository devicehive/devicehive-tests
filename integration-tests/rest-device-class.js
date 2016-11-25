var assert = require('assert');
var async = require('async');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;

describe('REST API Device Class', function () {
    this.timeout(90000);

    var helper = utils.deviceClass;

    describe('#Get All', function () {

        var DEVICE_CLASS = utils.getName('device-class');

        before(function (done) {
            var params = helper.getParams(DEVICE_CLASS, utils.jwt.admin, '1');
            utils.create(path.DEVICE_CLASS, params, function (err) {
                done(err);
            })
        });

        it('should get when using admin jwt', function (done) {
            utils.get(path.DEVICE_CLASS, {jwt: utils.jwt.admin}, function (err, result) {
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
    });

    describe('#Get for User', function () {

        var DEVICE_CLASS = utils.getName('device-class-1');
        var VERSION = '1';
        var user = null;
        var deviceClassId = null;
        var jwt = null;

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
                var params = helper.getParams(DEVICE_CLASS, utils.jwt.admin, VERSION);
                utils.create(path.DEVICE_CLASS, params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    deviceClassId = result.id;
                    callback();
                })
            }

            function createJWT(callback) {
                utils.jwt.create(user.id, 'GetDeviceClass', void 0, void 0, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    jwt = result.accessToken;
                    callback()
                })
            }

            async.series([
                createUser,
                createDeviceClass,
                createJWT
            ], done);
        });

        it('should get device class', function (done) {
            var params = {jwt: jwt, id: deviceClassId};
            utils.get(path.DEVICE_CLASS, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                utils.matches(result, {name: DEVICE_CLASS});
                done();
            })
        });
    });

    describe('#Create', function () {

        it('should create device class with admin credentials', function (done) {
            var DEVICE_CLASS = utils.getName('device-class-2');
            var VERSION = '1';

            var params = helper.getParams(DEVICE_CLASS, utils.jwt.admin, VERSION);
            utils.create(path.DEVICE_CLASS, params, function (err, result) {
                if (err) {
                    return done(err);
                }

                var params = {jwt: utils.jwt.admin, id: result.id};
                utils.get(path.DEVICE_CLASS, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    utils.matches(result, {name: DEVICE_CLASS});
                    done();
                })
            })
        });

        it('should return error when trying to create existing device class', function (done) {
            var DEVICE_CLASS = utils.getName('device-class-3');
            var VERSION = '1';

            var params = helper.getParams(DEVICE_CLASS, utils.jwt.admin, VERSION);
            utils.create(path.DEVICE_CLASS, params, function (err) {
                if (err) {
                    return done(err);
                }

                var params = helper.getParams(DEVICE_CLASS, utils.jwt.admin, VERSION);
                utils.create(path.DEVICE_CLASS, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'DeviceClass cannot be created. Device class with such name and version already exists');
                    assert.strictEqual(err.httpStatus, status.FORBIDDEN);
                    done();
                })
            })
        });

        it('should return bad request', function (done) {
            var params = {
                jwt: utils.jwt.admin,
                data: {
                    name: utils.getInvalidName()
                }
            };
            utils.create(path.DEVICE_CLASS, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.httpStatus, status.BAD_REQUEST);
                done();
            })
        })
    });

    describe('#Update', function () {

        var deviceClassId = null;

        before(function (done) {
            var params = helper.getParamsObj(utils.getName('device-class-4'), utils.jwt.admin, '1');
            utils.create(path.DEVICE_CLASS, params, function (err, result) {
                if (err) {
                    return done(err);
                }

                deviceClassId = result.id;
                done();
            })
        });

        it('should update using admin authorization', function (done) {
            var params = helper.getParamsObj(utils.getName('device-class-4-upd-1'), utils.jwt.admin, '2', true, 3600,
                {
                    name: utils.getName('eqpmnt-1'),
                    type: utils.getName('type-1'),
                    code: utils.getName('code-1')
                }, { a: 'b' });
            params.id = deviceClassId;
            var update = params.data;

            utils.update(path.DEVICE_CLASS, params, function (err) {
                if (err) {
                    return done(err);
                }

                var params = {jwt: utils.jwt.admin, id: deviceClassId};
                utils.get(path.DEVICE_CLASS, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    utils.matches(result, update);
                    done();
                })
            });
        });

        it('should partially update using admin authorization', function (done) {

            var params = helper.getParamsObj(utils.getName('device-class-4-upd-2'), utils.jwt.admin, '3', false);
            params.id = deviceClassId;
            var update = params.data;

            utils.update(path.DEVICE_CLASS, params, function (err) {
                if (err) {
                    return done(err);
                }

                var params = {jwt: utils.jwt.admin, id: deviceClassId};
                utils.get(path.DEVICE_CLASS, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    utils.matches(result, update);
                    done();
                })
            });
        })
    });

    describe('#Delete', function () {
        it('should delete device class using admin authorization', function (done) {
            var params = helper.getParamsObj(utils.getName('device-class-5'), utils.jwt.admin, '1');
            utils.create(path.DEVICE_CLASS, params, function (err, result) {
                if (err) {
                    return done(err);
                }

                var deviceClassId = result.id;
                var params = {jwt: utils.jwt.admin, id: deviceClassId};
                utils.delete(path.DEVICE_CLASS, params, function (err) {
                    assert.strictEqual(!(!err), false, 'No error');

                    utils.get(path.DEVICE_CLASS, params, function (err) {
                        assert.strictEqual(!(!err), true, 'Error object created');
                        assert.strictEqual(err.error, format('DeviceClass with id = %d not found', deviceClassId));
                        assert.strictEqual(err.httpStatus, status.NOT_FOUND);
                        done();
                    })
                })
            })
        })
    });

    describe('#Unauthorized', function () {

        describe('#No Authorization', function () {
            it('should return error when accessing device class without authorization', function (done) {
                var params = {jwt: null};
                utils.get(path.DEVICE_CLASS, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            });

            it('should return error when accessing non-existing device class without authorization', function (done) {
                var params = {user: null, id: utils.NON_EXISTING_ID };
                utils.get(path.DEVICE_CLASS, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            });

            it('should return error when creating device class without authorization', function (done) {
                var params = helper.getParamsObj(utils.getName('create-no-auth'), null, '1');
                utils.create(path.DEVICE_CLASS, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            });

            it('should return error when updating non-existing device class without authorization', function (done) {
                var params = helper.getParamsObj(utils.getName('update-non-existing'), null, '2');
                params.id = utils.NON_EXISTING_ID;
                utils.update(path.DEVICE_CLASS, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            });

            it('should return error when deleting non-existing device class without authorization', function (done) {
                var params = {user: null, id: utils.NON_EXISTING_ID};
                utils.delete(path.DEVICE_CLASS, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            })
        });

        describe('#Another User Authorization', function () {
            var user = null;
            var jwt = null;

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

                function createJWT(callback) {
                    utils.jwt.create(user.id, 'GetDeviceClass', void 0, void 0, function (err, result) {
                        if (err) {
                            return callback(err);
                        }
                        jwt = result.accessToken;
                        callback()
                    })
                }

                async.series([
                    createUser,
                    createJWT
                ], done);
            });

            it('should return error when accessing device class with another user', function (done) {
                var params = {jwt: jwt};
                utils.get(path.DEVICE_CLASS, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            });

            it('should return error when creating device class using wrong user credentials', function (done) {
                var params = helper.getParamsObj(utils.getName('create-other-user'), user);
                utils.create(path.DEVICE_CLASS, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            });

            it('should return error when updating non-existing device class', function (done) {
                var params = helper.getParamsObj(utils.getName('update-non-existing'), user, '3');
                params.id = utils.NON_EXISTING_ID;
                utils.update(path.DEVICE_CLASS, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            });

            it('should return error when deleting non-existing device class', function (done) {
                var params = {jwt: jwt, id: utils.NON_EXISTING_ID};
                utils.delete(path.DEVICE_CLASS, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            })
        })
    });

    describe('#Not Found', function () {

        it('should return error when accessing non-existing device class', function (done) {
            var params = {jwt: utils.jwt.admin, id: utils.NON_EXISTING_ID };
            utils.get(path.DEVICE_CLASS, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, format('DeviceClass with id = %d not found',
                    utils.NON_EXISTING_ID));
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);
                done();
            })
        });

        it('should return error when updating non-existing device class', function (done) {
            var params = helper.getParamsObj(utils.getName('update-non-existing'), utils.jwt.admin, '1');
            params.id = utils.NON_EXISTING_ID;
            utils.update(path.DEVICE_CLASS, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, format('DeviceClass with id = %d not found',
                    utils.NON_EXISTING_ID));
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);
                done();
            })
        });

        it('should not return error when deleting non-existing device class', function (done) {
            var params = {jwt: utils.jwt.admin, id: utils.NON_EXISTING_ID};
            utils.delete(path.DEVICE_CLASS, params, function (err) {
                assert.strictEqual(!(!err), false, 'No error');
                done();
            })
        })
    });

    after(function (done) {
        utils.clearDataJWT(done);
    })
});