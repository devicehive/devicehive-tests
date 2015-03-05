var assert = require('assert');
var async = require('async');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;

describe.only('REST API Device', function () {
    this.timeout(30000);

    var helper = utils.device;

    var NETWORK = '_integr-test-network-device';
    var DEVICE = '_integr-test-device';
    var DEVICE_GUID = 'INTEGR-TEST-DEVICE-GUID-12345';
    //var ANOTHER_DEVICE_GUID = 'INTEGR-TEST-ANOTHER-DEVICE-GUID-54321';
    var DEVICE_KEY = 'INTEGR-TEST-DEVICE-NOTIF-KEY';

    var networkId = null;
    var user = null;
    var nonNetworkUser = null;
    var deviceClassId = null;

    before(function (done) {

        path.current = path.DEVICE;

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
                callback();
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

        function createUser(callback) {
            utils.createUser2(1, networkId, function (err, result) {
                if (err) {
                    return callback(err);
                }

                user = result.user;
                callback();
            });
        }

        function createNonNetworkUser(callback) {
            utils.createUser2(1, void 0, function (err, result) {
                if (err) {
                    return callback(err);
                }

                nonNetworkUser = result.user;
                callback();
            });
        }

        async.series([
            createNetwork,
            createDeviceClass,
            createUser,
            createNonNetworkUser
        ], done);
    });

    describe('#GetAll', function () {

        var accessKey1 = null;
        var accessKey2 = null;

        before(function (done) {

            function createDevice(callback) {
                var params = helper.getParamsObj(DEVICE, utils.admin, DEVICE_KEY,
                    {name: NETWORK}, {name: DEVICE, version: '1'});
                params.id = DEVICE_GUID;
                utils.update(path.DEVICE, params, function (err) {
                    callback(err);
                });
            }

            function createAccessKeys(callback) {

                var params = [
                    {
                        user: user,
                        actions: 'GetDevice',
                        networkIds: [0]
                    },
                    {
                        user: user,
                        actions: 'GetDevice',
                        deviceIds: utils.NON_EXISTING_ID
                    }
                ];

                utils.accessKey.createMany(params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    accessKey1 = result[0];
                    accessKey2 = result[1];

                    callback();
                });
            }

            async.series([
                createDevice,
                createAccessKeys
            ], done);
        });

        it('should get device by name', function (done) {
            var params = {user: utils.admin};
            params.query = path.query('name', DEVICE);
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true, 'Is array of 1 object');

                assert.strictEqual(result.some(function (item) {
                    return item.id === DEVICE_GUID;
                }), true);

                done();
            })
        });

        it('should get device by network', function (done) {
            var params = {user: utils.admin};
            params.query = path.query('networkId', networkId);
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true, 'Is array of 1 object');

                assert.strictEqual(result.some(function (item) {
                    return item.id === DEVICE_GUID;
                }), true);

                done();
            })
        });

        it('should get device by device class', function (done) {
            var params = {user: utils.admin};
            params.query = path.query('deviceClassId', deviceClassId);
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true, 'Is array of 1 object');

                assert.strictEqual(result.some(function (item) {
                    return item.id === DEVICE_GUID;
                }), true);

                done();
            })
        });

        it('should get all devices', function (done) {
            utils.get(path.current, {user: user}, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true, 'Is array of 1 object');

                assert.strictEqual(result.some(function (item) {
                    return item.id === DEVICE_GUID;
                }), true);

                done();
            })
        });

        it('should get zero devices when using key with no access #1', function (done) {
            utils.get(path.current, {accessKey: accessKey1}, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isEmptyArray(result), true);

                done();
            })
        });

        it('should get zero devices when using key with no access #2', function (done) {
            utils.get(path.current, {accessKey: accessKey2}, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isEmptyArray(result), true);

                done();
            })
        });
    });

    describe('#Get', function () {

        var invalidAccessKey1 = null;
        var invalidAccessKey2 = null;
        var invalidAccessKey3 = null;
        var accessKey = null;

        before(function (done) {

            function createDevice(callback) {
                var params = helper.getParamsObj(DEVICE, utils.admin, DEVICE_KEY,
                    {name: NETWORK}, {name: DEVICE, version: '1'});
                params.id = DEVICE_GUID;
                utils.update(path.DEVICE, params, function (err) {
                    callback(err);
                });
            }

            function createAccessKeys(callback) {

                var params = [
                    {
                        user: nonNetworkUser,
                        actions: 'GetDevice'
                    },
                    {
                        user: user,
                        actions: 'GetDevice',
                        networkIds: [0]
                    },
                    {
                        user: user,
                        actions: 'GetDevice',
                        deviceIds: utils.NON_EXISTING_ID
                    },
                    {
                        user: user,
                        actions: 'GetDevice'
                    },
                ];

                utils.accessKey.createMany(params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    invalidAccessKey1 = result[0];
                    invalidAccessKey2 = result[1];
                    invalidAccessKey3 = result[2];
                    accessKey = result[3];

                    callback();
                });
            }

            async.series([
                createDevice,
                createAccessKeys
            ], done);
        });

        it('should return error when accessing device with wrong user', function (done) {
            var params = {user: nonNetworkUser};
            params.id = DEVICE_GUID;
            utils.get(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error,
                    format('DeviceHive server error - Device with such guid = %s not found',
                    DEVICE_GUID));
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);

                done();
            })
        });

        it('should succeed when accessing device with allowed user', function (done) {
            var params = {user: user};
            params.id = DEVICE_GUID;
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(result.id, DEVICE_GUID);
                assert.strictEqual(result.name, DEVICE);

                done();
            })
        });

        it('should fail with 404 #1', function (done) {
            var params = {accessKey: invalidAccessKey1};
            params.id = DEVICE_GUID;
            utils.get(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, format('DeviceHive server error - Device with such guid = %s not found',
                    DEVICE_GUID));
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);

                done();
            });
        });

        it('should fail with 404 #2', function (done) {
            var params = {accessKey: invalidAccessKey2};
            params.id = DEVICE_GUID;
            utils.get(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, format('DeviceHive server error - Device with such guid = %s not found',
                    DEVICE_GUID));
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);

                done();
            });
        });

        it('should fail with 404 #3', function (done) {
            var params = {accessKey: invalidAccessKey3};
            params.id = DEVICE_GUID;
            utils.get(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, format('DeviceHive server error - Device with such guid = %s not found',
                    DEVICE_GUID));
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);

                done();
            });
        });

        it('should succeed when using valid access key', function (done) {
            var params = {accessKey: accessKey};
            params.id = DEVICE_GUID;
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(result.id, DEVICE_GUID);
                assert.strictEqual(result.name, DEVICE);

                done();
            });
        });
    });

    after(function (done) {
        utils.clearResources(done);
    });
});