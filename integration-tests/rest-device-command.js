var assert = require('assert');
var async = require('async');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;
var consts = require('./common/consts');

describe('REST API Device Command', function () {

    var helper = utils.command;
    var NETWORK = '_integr-test-network-device-cmd';
    var DEVICE = '_integr-test-device-cmd';
    var DEVICE_GUID = 'INTEGR-TEST-DEVICE-GUID-CMD-12345';
    var DEVICE_KEY = 'INTEGR-TEST-DEVICE-CMD-KEY';
    var networkId = null;
    var deviceClassId = null;
    var user = null;
    var nonNetworkUser = null;
    var COMMAND = '_integr-test-cmd-1';
    var commandId = null;

    before(function (done) {

        path.current = path.combine(path.DEVICE, DEVICE_GUID, 'command');

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
            var params = utils.device.getParamsObj(DEVICE, utils.admin, DEVICE_KEY,
                {name: NETWORK}, {name: DEVICE, version: '1'});
            params.id = DEVICE_GUID;
            utils.update(path.DEVICE, params, function (err) {
                callback(err);
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

        function createCommand(callback) {
            var params = helper.getParamsObj(COMMAND, user);
            utils.create(path.current, params, function (err, result) {
                if (err) {
                    return callback(err);
                }

                commandId = result.id;

                var params = helper.getParamsObj('_integr-test-cmd-2', user);
                utils.create(path.current, params, function (err) {
                    callback(err);
                })
            })
        }

        async.series([
            createNetwork,
            createDeviceClass,
            createDevice,
            createUser,
            createNonNetworkUser,
            createCommand
        ], done);
    });

    function hasCommand(item) {
        return item.id === commandId && item.command === COMMAND;
    }

    describe('#GetAll', function () {

        it('should get all two commands for user', function (done) {
            utils.get(path.current, {user: user}, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 2), true, 'Is array of 2 objects');
                assert.strictEqual(result.some(hasCommand), true);

                done();
            })
        });

        it('should return user command by name', function (done) {
            var params = {user: user};
            params.query = path.query('command', COMMAND);
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true, 'Is array of 1 object');
                assert.strictEqual(result.some(hasCommand), true);

                done();
            });
        });

        it('should return user commands by start date', function (done) {
            var params = {user: user};
            var date = new Date();
            date.setHours(date.getHours() - 1);
            params.query = path.query('start', date.toISOString());
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 2), true, 'Is array of 2 objects');
                assert.strictEqual(result.some(hasCommand), true);

                done();
            });
        });

        it('should return empty commands list when start date is out of range', function (done) {
            var params = {user: user};
            var date = new Date();
            date.setHours(date.getHours() + 1);
            params.query = path.query('start', date.toISOString());
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isEmptyArray(result), true, 'Is empty array');

                done();
            });
        });

        it('should return user commands by end date', function (done) {
            var params = {user: user};
            var date = new Date();
            date.setHours(date.getHours() + 1);
            params.query = path.query('end', date.toISOString());
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 2), true, 'Is array of 2 objects');
                assert.strictEqual(result.some(hasCommand), true);

                done();
            });
        });

        it('should return empty commands list when end date is out of range', function (done) {
            var params = {user: user};
            var date = new Date();
            date.setHours(date.getHours() - 1);
            params.query = path.query('end', date.toISOString());
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isEmptyArray(result), true, 'Is empty array');

                done();
            });
        });
    })

    describe('#Get', function () {

        var invalidAccessKey1 = null;
        var invalidAccessKey2 = null;
        var invalidAccessKey3 = null;
        var accessKey = null;

        before(function (done) {
            function createInvalidAccessKey1(callback) {
                utils.accessKey.create(nonNetworkUser, void 0, 'GetDeviceCommand', void 0, void 0,
                    function (err, result) {
                        if (err) {
                            return callback(err);
                        }

                        invalidAccessKey1 = result.key;
                        callback();
                    });
            }

            function createInvalidAccessKey2(callback) {
                utils.accessKey.create(user, void 0, 'GetDeviceCommand', void 0, [0],
                    function (err, result) {
                        if (err) {
                            return callback(err);
                        }

                        invalidAccessKey2 = result.key;
                        callback();
                    });
            }

            function createInvalidAccessKey3(callback) {
                utils.accessKey.create(user, void 0, 'GetDeviceCommand', consts.NON_EXISTING_ID, void 0,
                    function (err, result) {
                        if (err) {
                            return callback(err);
                        }

                        invalidAccessKey3 = result.key;
                        callback();
                    });
            }

            function createAccessKey(callback) {
                utils.accessKey.create(user, void 0, 'GetDeviceCommand', void 0, void 0,
                    function (err, result) {
                        if (err) {
                            return callback(err);
                        }

                        accessKey = result.key;
                        callback();
                    });
            }

            async.series([
                createInvalidAccessKey1,
                createInvalidAccessKey2,
                createInvalidAccessKey3,
                createAccessKey
            ], done);
        })

        it('should return commands using device authentication', function (done) {
            var params = {
                device: {
                    id: DEVICE_GUID,
                    key: DEVICE_KEY
                }
            };
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 2), true, 'Is array of 2 objects');
                assert.strictEqual(result.some(hasCommand), true);

                done();
            });
        });

        it('should return error when using wrong user authentication', function (done) {
            var params = {user: nonNetworkUser};
            utils.get(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, format('DeviceHive server error - Device with such guid = %s not found',
                    DEVICE_GUID));
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);

                done();
            });
        });

        it('should succeed when using valid user authentication', function (done) {
            var params = {user: user};
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 2), true, 'Is array of 2 objects');
                assert.strictEqual(result.some(hasCommand), true);

                done();
            });
        });

        it('should succeed when using valid user authentication', function (done) {
            var params = {user: user};
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 2), true, 'Is array of 2 objects');
                assert.strictEqual(result.some(hasCommand), true);

                done();
            });
        });

        it('should fail with 404 #1', function (done) {
            var params = {accessKey: invalidAccessKey1};
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
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 2), true, 'Is array of 2 objects');
                assert.strictEqual(result.some(hasCommand), true);

                done();
            });
        });
    })


    after(function (done) {
        utils.clearResources(done);
    });
})