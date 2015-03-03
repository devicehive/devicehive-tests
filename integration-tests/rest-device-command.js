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
    var COMMAND = '_integr-test-cmd-1';
    var COMMAND_2 = '_INTEGR-TEST-CMD-2';

    var networkId = null;
    var deviceClassId = null;
    var user = null;
    var nonNetworkUser = null;
    var commandId = null;

    before(function (done) {

        path.current = path.combine(path.DEVICE, DEVICE_GUID, path.COMMAND);

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

            var params = [
                {
                    user: nonNetworkUser,
                    actions: 'GetDeviceCommand'
                },
                {
                    user: user,
                    actions: 'GetDeviceCommand',
                    networkIds: [0]
                },
                {
                    user: user,
                    actions: 'GetDeviceCommand',
                    deviceIds: consts.NON_EXISTING_ID
                },
                {
                    user: user,
                    actions: 'GetDeviceCommand'
                },
            ];

            utils.accessKey.createMany(params, function (err, result) {
                if (err) {
                    return done(err);
                }

                invalidAccessKey1 = result[0];
                invalidAccessKey2 = result[1];
                invalidAccessKey3 = result[2];
                accessKey = result[3];

                done();
            })
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

    describe('#Poll', function () {
        it('should return new command when adding command with specified name', function (done) {
            var params = {user: user};
            var $path = path.combine(path.current, path.POLL);
            params.query = path.query('names', COMMAND);
            utils.get($path, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true);
                assert.strictEqual(result.every(function (item) {
                    return item.command === COMMAND;
                }), true);
                done();
            })

            setTimeout(function () {
                var params = helper.getParamsObj(COMMAND_2, user);
                utils.create(path.current, params, function () {})
            }, 100);

            setTimeout(function () {
                var params = helper.getParamsObj(COMMAND, user);
                utils.create(path.current, params, function () {})
            }, 100);
        })
    });

    describe('#Poll No Wait', function () {
        it('should return immediately with empty result', function (done) {
            var params = {user: user};
            var $path = path.combine(path.current, path.POLL);
            params.query = path.query('waitTimeout', '0');
            utils.get($path, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isEmptyArray(result), true);
                done();
            })
        })
    });

    describe('#Poll Many', function () {
        it('should return result with deviceGuid', function (done) {
            var params = {user: user};
            var $path = path.combine(path.DEVICE, path.COMMAND, path.POLL);
            params.query = path.query('names', COMMAND, 'deviceGuids', DEVICE_GUID);
            utils.get($path, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true);
                assert.strictEqual(result.every(function (item) {
                    return item.command.command === COMMAND && item.deviceGuid === DEVICE_GUID;
                }), true);
                done();
            })

            setTimeout(function () {
                var params = helper.getParamsObj(COMMAND_2, user);
                utils.create(path.current, params, function () {})
            }, 100);

            setTimeout(function () {
                var params = helper.getParamsObj(COMMAND, user);
                utils.create(path.current, params, function () {})
            }, 100);
        })
    });

    describe('#Poll Many - Other Device', function () {

        var OTHER_NETWORK = '_integr-test-OTHER-network-cmd';
        var otherNetworkId = null;
        var OTHER_DEVICE_GUID = 'OTHER-DEVICE-GUID-1234'

        before(function (done) {

            function createNetwork(callback) {
                var params = {
                    user: utils.admin,
                    data: {
                        name: OTHER_NETWORK
                    }
                };

                utils.create(path.NETWORK, params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    otherNetworkId = result.id;
                    callback()
                });
            }

            function createDevice(callback) {
                var params = utils.device.getParamsObj('_integr-test-OTHER-device-cmd', utils.admin, DEVICE_KEY,
                    {name: OTHER_NETWORK}, {name: DEVICE, version: '1'});
                params.id = OTHER_DEVICE_GUID;
                utils.update(path.DEVICE, params, function (err) {
                    callback(err);
                });
            }

            async.series([
                createNetwork,
                createDevice
            ], done);
        });

        it('should return current device command', function (done) {
            var params = {user: user};
            var $path = path.combine(path.DEVICE, path.COMMAND, path.POLL);
            utils.get($path, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true);
                assert.strictEqual(result.every(function (item) {
                    return item.command.command === COMMAND_2 && item.deviceGuid === DEVICE_GUID;
                }), true);
                done();
            })

            setTimeout(function () {
                var params = helper.getParamsObj(COMMAND_2, utils.admin);
                var $path = path.combine(path.DEVICE, OTHER_DEVICE_GUID, path.COMMAND);
                utils.create($path, params, function () {})
            }, 100);

            setTimeout(function () {
                var params = helper.getParamsObj(COMMAND_2, utils.admin);
                utils.create(path.current, params, function () {})
            }, 100);
        })
    });

    describe('#Poll Many No Wait', function () {
        it('should return immediately with empty result', function (done) {
            var params = {user: user};
            var $path = path.combine(path.DEVICE, path.COMMAND, path.POLL);
            params.query = path.query('waitTimeout', '0');
            utils.get($path, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isEmptyArray(result), true);
                done();
            })
        })
    });

    describe('#Poll by id', function () {

        var commandUpdate = {
            status: 'Done',
            result: 'OK'
        };

        it('should return command with updated status/result values', function (done) {
            var params = {user: user};
            var $path = path.combine(path.current, commandId, path.POLL);
            params.query = path.query('names', COMMAND);
            utils.get($path, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(result.status, commandUpdate.status);
                assert.strictEqual(result.result, commandUpdate.result);
                done();
            })

            setTimeout(function () {
                var params = {user: user};
                params.id = commandId;
                params.data = commandUpdate;
                utils.update(path.current, params, function () {})
            }, 100);
        })
    });

    describe('#Create', function () {

        var invalidAccessKey1 = null;
        var invalidAccessKey2 = null;
        var invalidAccessKey3 = null;
        var accessKey = null;

        before(function (done) {

            var params = [
                {
                    user: nonNetworkUser,
                    actions: 'CreateDeviceCommand'
                },
                {
                    user: user,
                    actions: 'CreateDeviceCommand',
                    networkIds: [0]
                },
                {
                    user: user,
                    actions: 'CreateDeviceCommand',
                    deviceIds: consts.NON_EXISTING_ID
                },
                {
                    user: user,
                    actions: 'CreateDeviceCommand'
                },
            ];

            utils.accessKey.createMany(params, function (err, result) {
                if (err) {
                    return done(err);
                }

                invalidAccessKey1 = result[0];
                invalidAccessKey2 = result[1];
                invalidAccessKey3 = result[2];
                accessKey = result[3];

                done();
            })
        });

        it('should return error when creating command with invalid user', function (done) {
            var params = helper.getParamsObj(COMMAND, nonNetworkUser);
            utils.create(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, format('DeviceHive server error - Device with such guid = %s not found',
                    DEVICE_GUID));
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);

                done();
            })
        });

        it('should succeed when creating command with allowed user', function (done) {
            var params = helper.getParamsObj(COMMAND, user);
            utils.create(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                if (err) {
                    return done(err);
                }

                var timestamp = result.timestamp;
                params.id = result.id;
                utils.get(path.current, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    assert.strictEqual(result.command, COMMAND);
                    assert.strictEqual(result.userId, user.id);
                    assert.strictEqual(new Date(result.timestamp).toUTCString(),
                        new Date(timestamp).toUTCString());
                    done();
                })
            })
        });

        it('should fail with 404 #1', function (done) {
            var params = helper.getParamsObj(COMMAND);
            params.accessKey = invalidAccessKey1;
            utils.create(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, format('DeviceHive server error - Device with such guid = %s not found',
                    DEVICE_GUID));
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);

                done();
            });
        });

        it('should fail with 404 #2', function (done) {
            var params = helper.getParamsObj(COMMAND);
            params.accessKey = invalidAccessKey2;
            utils.create(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, format('DeviceHive server error - Device with such guid = %s not found',
                    DEVICE_GUID));
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);

                done();
            });
        });

        it('should fail with 404 #3', function (done) {
            var params = helper.getParamsObj(COMMAND);
            params.accessKey = invalidAccessKey3;
            utils.create(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, format('DeviceHive server error - Device with such guid = %s not found',
                    DEVICE_GUID));
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);

                done();
            });
        });

        it.only('should succeed when using valid access key', function (done) {
            var params = helper.getParamsObj(COMMAND);
            params.accessKey = accessKey;
            utils.create(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(result.userId, user.id);

                done();
            });
        });
    })

    after(function (done) {
        utils.clearResources(done);
    });
})