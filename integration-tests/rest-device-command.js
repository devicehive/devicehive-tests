var assert = require('assert');
var async = require('async');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;

describe('REST API Device Command', function () {
    this.timeout(90000);

    var helper = utils.command;

    var NETWORK = utils.getName('network-device-cmd');
    var DEVICE = utils.getName('device-cmd');
    var DEVICE_ID = utils.getName('id-cmd-12345');
    var COMMAND = utils.getName('cmd-1');
    var COMMAND_2 = utils.getName('cmd-2');

    var user = null;
    var jwt = null;
    var nonNetworkUser = null;
    var commandId = null;
    var beforeCreateCommandsTimestamp = new Date().getTime();
    var networkId = null;

    function hasCommand(item) {
        return item.id === commandId && item.command === COMMAND;
    }

    before(function (done) {
        path.current = path.COMMAND.get(DEVICE_ID);

        function createNetwork(callback) {
            var params = {
                jwt: utils.jwt.admin,
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

        function createDevice(callback) {
            var params = utils.device.getParamsObj(DEVICE, utils.jwt.admin,
                networkId, {name: DEVICE, version: '1'});
            params.id = DEVICE_ID;
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

        function createJWT(callback) {
            utils.jwt.create(user.id, ['CreateDeviceCommand', 'GetDeviceCommand', 'UpdateDeviceCommand'], [networkId], [DEVICE_ID], function (err, result) {
                if (err) {
                    return callback(err);
                }
                jwt = result.accessToken;
                callback()
            })
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
            var params = helper.getParamsObj(COMMAND, jwt);
            utils.create(path.current, params, function (err, result) {
                if (err) {
                    return callback(err);
                }

                commandId = result.id;

                var params = helper.getParamsObj(utils.getName('cmd-2'), jwt);
                utils.create(path.current, params, function (err) {
                    setTimeout(function () {
                        callback(err);
                    }, 2000);
                })
            })
        }

        async.series([
            createNetwork,
            createDevice,
            createUser,
            createJWT,
            createNonNetworkUser,
            createCommand
        ], done);
    });

    describe('#Get All', function () {

        it('should get all two commands for user', function (done) {
            utils.get(path.current, {jwt: jwt}, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 2), true, 'Is array of 2 objects');
                assert.strictEqual(result.some(hasCommand), true);

                done();
            })
        });

        it('should return user command by name', function (done) {
            var params = {jwt: jwt};
            params.query = path.query('command', COMMAND);
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true, 'Is array of 1 object');
                assert.strictEqual(result.some(hasCommand), true);

                done();
            });
        });

        it('should return user commands by start date without timezone', function (done) {
            var params = {jwt: jwt};
            var date = new Date();
            date.setHours(date.getHours() - 1);
            var dateISOString = date.toISOString();
            params.query = path.query('start', dateISOString.substring(0, dateISOString.length - 1));
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 2), true, 'Is array of 2 objects');
                assert.strictEqual(result.some(hasCommand), true);

                done();
            });
        });

        it('should return user commands by start date with timezone', function (done) {
            var params = {jwt: jwt};
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
            var params = {jwt: jwt};
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
            var params = {jwt: jwt};
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
    });

    describe('#Get', function () {

        var invalidJWT1 = null;
        var invalidJWT2 = null;
        var invalidJWT3 = null;
        var jwt = null;

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
                    deviceIds: utils.NON_EXISTING_ID
                },
                {
                    user: user,
                    actions: 'GetDeviceCommand',
                    deviceIds: DEVICE_ID,
                    networkIds: networkId
                }
            ];

            utils.jwt.createMany(params, function (err, result) {
                if (err) {
                    return done(err);
                }

                invalidJWT1 = result[0];
                invalidJWT2 = result[1];
                invalidJWT3 = result[2];
                jwt = result[3];

                done();
            })
        });

        it('should fail with 403 #1', function (done) {
            var params = {jwt: invalidJWT1};
            utils.get(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Access is denied');
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);

                done();
            });
        });

        it('should fail with 403 #2', function (done) {
            var params = {jwt: invalidJWT2};
            utils.get(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Access is denied');
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);

                done();
            });
        });

        it('should fail with 403 #3', function (done) {
            var params = {jwt: invalidJWT3};
            utils.get(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Access is denied');
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);

                done();
            });
        });

        it('should succeed when using valid jwt', function (done) {
            var params = {jwt: jwt};
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 2), true, 'Is array of 2 objects');
                assert.strictEqual(result.some(hasCommand), true);

                done();
            });
        });
    });

    describe('#Poll', function () {
        it('should return new command when adding command with specified name', function (done) {
            var params = {jwt: jwt};
            var $path = path.combine(path.current, path.POLL);
            params.query = path.query('names', COMMAND);
            utils.get($path, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true);
                assert.strictEqual(result.every(function (item) {
                    return item.command === COMMAND;
                }), true);
                done();
            });

            setTimeout(function () {
                var params = helper.getParamsObj(COMMAND_2, jwt);
                utils.create(path.current, params, function () {});
            }, 100);

            setTimeout(function () {
                var params = helper.getParamsObj(COMMAND, jwt);
                utils.create(path.current, params, function () {});
            }, 100);
        });

        it('should return array with commands when poll with waitTimeout=3', function (done) {
            var params = {jwt: jwt};
            var $path = path.combine(path.current, path.POLL);
            params.query = path.query('waitTimeout', 3);
            utils.get($path, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(result.length > 0, true);
                assert.strictEqual(result[0].timestamp === result[0].lastUpdated, true);
                done();
            });

            setTimeout(function () {
                var params = helper.getParamsObj(COMMAND, jwt);
                utils.create(path.current, params, function () {});
            }, 1000);
        })

        it('should return array with commands when poll updated with waitTimeout=3', function (done) {
            var params = {
                jwt: jwt
            };
            var $path = path.combine(path.current, path.POLL);
            params.query = path.query('waitTimeout', 3, 'returnUpdatedCommands', true);
            utils.get($path, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(result.length > 0, true);
                assert.strictEqual(result[0].timestamp !== result[0].lastUpdated, true);
                done();
            });

            setTimeout(function () {
                var params = helper.getParamsObj(COMMAND, jwt);
                utils.create(path.current, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    params.id = result.id;
                    utils.update(path.current, params, function () {});
                });
            }, 100);
        })

        it('should return empty array with commands when poll updated with waitTimeout=3', function (done) {
            var params = {
                jwt: jwt
            };
            var $path = path.combine(path.current, path.POLL);
            params.query = path.query('waitTimeout', 3, 'returnUpdatedCommands', true);
            utils.get($path, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(result.length === 0, true);
                done();
            });

            setTimeout(function () {
                var params = helper.getParamsObj(COMMAND, jwt);
                utils.create(path.current, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                });
            }, 100);
        })
    });

    describe('#Poll limit', function () {
        it('should return limited array with commands', function (done) {
            var params = {jwt: jwt};
            var $path = path.combine(path.current, path.POLL);

            params.query = path.query('waitTimeout', 3, 'timestamp', beforeCreateCommandsTimestamp, 'limit', 3);
            utils.get($path, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(result.length === 3, true);
                done();
            });

            setTimeout(function () {
                for (i = 0; i < 5; i++) {
                    var params = helper.getParamsObj(utils.getName('' + i), jwt);
                    utils.create(path.current, params, function () {});
                }
            }, 100)

        })
    });

    describe('#Poll No Wait', function () {
        it('should return immediately with empty result', function (done) {
            var params = {jwt: jwt};
            var $path = path.combine(path.current, path.POLL);
            params.query = path.query('waitTimeout', '0');
            utils.get($path, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isEmptyArray(result), true);
                done();
            })
        });
        it('should return immediately array with commands when poll with waitTimeout=0 and timestamp', function (done) {
            var params = {jwt: jwt};
            var $path = path.combine(path.current, path.POLL);
            params.query = path.query('waitTimeout', 0, 'timestamp', beforeCreateCommandsTimestamp);
            utils.get($path, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(result.length > 0, true);
                done();
            });
        })
    });

    describe('#Poll Many', function () {
        it('should return result with deviceId', function (done) {
            var params = {jwt: jwt};
            params.query = path.query('names', COMMAND, 'deviceIds', DEVICE_ID);
            utils.get(path.COMMAND.poll(), params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true);
                assert.strictEqual(result.every(function (item) {
                    return item.command === COMMAND && item.deviceId === DEVICE_ID;
                }), true);
                done();
            });

            setTimeout(function () {
                var params = helper.getParamsObj(COMMAND_2, jwt);
                utils.create(path.current, params, function () {});
            }, 100);

            setTimeout(function () {
                var params = helper.getParamsObj(COMMAND, jwt);
                utils.create(path.current, params, function () {});
            }, 100);
        });

        it('should not return command with the same timestamp', function (done) {
            var globalId = -1;
            var globalTimestamp = "";

            function pollWithoutTimestamp(callback){
                var params = {jwt: jwt};
                params.query = path.query('names', COMMAND, 'deviceIds', DEVICE_ID, "waitTimeout", 5);
                utils.get(path.COMMAND.poll(), params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    assert.strictEqual(utils.core.isArrayOfLength(result, 1), true);
                    callback(result);
                });
            }

            function updateCommand(callback){
                var params = {jwt: jwt, data: {"newField": "newValue"}};
                utils.update(path.combine(path.COMMAND.get(DEVICE_ID), globalId), params, function (err) {
                    assert.strictEqual(!(!err), false, 'No error');
                    callback(err);
                });
            }

            function pollWithTimestamp(){
                    var params = {jwt: jwt};
                    params.query = path.query('names', COMMAND, 'deviceIds', DEVICE_ID, "waitTimeout", 1, 'timestamp', globalTimestamp);
                    utils.get(path.COMMAND.poll(), params, function (err, result) {
                        assert.strictEqual(!(!err), false, 'No error');
                        assert.strictEqual(utils.core.isEmptyArray(result), true);
                        done()
                    });
            }


            async.series([pollWithoutTimestamp, updateCommand], pollWithTimestamp);

            var params = helper.getParamsObj(COMMAND, jwt);
            setTimeout(function(){utils.create(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                globalId = result.id;
                globalTimestamp = result.timestamp
            });}, 100);
        });

        it('should return an error when polling for the non existent device with client jwt', function (done) {
            var params = {jwt: jwt};
            var deviceList = path.COMMAND.get(DEVICE_ID + "%2C" + utils.NON_EXISTING_ID);
            var $path = path.combine(deviceList, path.POLL);
            params.query = path.query('waitTimeout', 3);
            utils.get($path, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Access is denied');
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);
                done();
            });
        });

        it('should return an error when polling for the non existent device with admin jwt', function (done) {
            var params = {jwt: utils.jwt.admin};
            var deviceList = path.COMMAND.get(DEVICE_ID + "%2C" + utils.NON_EXISTING_ID);
            var $path = path.combine(deviceList, path.POLL);
            params.query = path.query('waitTimeout', 3);
            utils.get($path, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, format('Devices with such deviceIds wasn\'t found: {[%d]}',
                    utils.NON_EXISTING_ID));
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);
                done();
            });
        });

    });

    describe('#Poll Many - Other Device', function () {

        var OTHER_NETWORK = utils.getName('other-network-cmd');
        var otherNetworkId = null;
        var OTHER_DEVICE_ID = 'other-id-1234';

        before(function (done) {

            function createNetwork(callback) {
                var params = {
                    jwt: utils.jwt.admin,
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
                var params = utils.device.getParamsObj(utils.getName('other-device-cmd'), utils.jwt.admin,
                    otherNetworkId, {name: DEVICE, version: '1'});
                params.id = OTHER_DEVICE_ID;
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
            var params = {jwt: jwt};
            utils.get(path.COMMAND.poll(), params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true);
                assert.strictEqual(result.every(function (item) {
                    return item.command === COMMAND_2 && item.deviceId === DEVICE_ID;
                }), true);
                done();
            });

            setTimeout(function () {
                var params = helper.getParamsObj(COMMAND_2, utils.jwt.admin);
                utils.create(path.COMMAND.get(OTHER_DEVICE_ID), params, function () {});
            }, 200);

            setTimeout(function () {
                var params = helper.getParamsObj(COMMAND_2, utils.jwt.admin);
                utils.create(path.current, params, function () {});
            }, 200);
        })
    });

    describe('#Poll Many No Wait', function () {
        it('should return immediately with empty result', function (done) {
            var params = {jwt: jwt};
            params.query = path.query('waitTimeout', '0');
            utils.get(path.COMMAND.poll(), params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isEmptyArray(result), true);
                done();
            })
        })
    });

    describe('#Poll by Id', function () {

        var commandUpdate = {
            status: 'Done',
            result: {status: 'OK'}
        };

        it('should return empty response with status 204 when polling not processed command', function (done) {
            var params = {jwt: jwt};
            var $path = path.combine(path.current, commandId, path.POLL);
            params.query = path.query('waitTimeout',0);
            utils.get($path, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(result, null);
                done();
            }, status.EXPECTED_UPDATED);
        });

        it('should return command with updated status/result values', function (done) {
            var params = {jwt: jwt};
            var $path = path.combine(path.current, commandId, path.POLL);
            params.query = path.query('names', COMMAND);
            utils.get($path, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(result.status, commandUpdate.status);
                assert.deepEqual(result.result, commandUpdate.result);
                done();
            });

            setTimeout(function () {
                var params = {jwt: jwt};
                params.id = commandId;
                params.data = commandUpdate;
                utils.update(path.current, params, function () {});
            }, 100);
        });

        it('should return processed command when polling processed command with waitTimeout = 0', function (done) {
            var params = {jwt: jwt};
            params.id = commandId;
            params.data = commandUpdate;
            utils.update(path.current, params, function () {});
            setTimeout(function () {
                var params = {jwt: jwt};
                var $path = path.combine(path.current, commandId, path.POLL);
                params.query = path.query('waitTimeout', 0);
                utils.get($path, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    assert.strictEqual(result.status, commandUpdate.status);
                    assert.deepEqual(result.result, commandUpdate.result);
                    done();
                });
            },10);
        });
    });

    describe('#Create', function () {

        var invalidJWT1 = null;
        var invalidJWT2 = null;
        var invalidJWT3 = null;
        var jwt = null;

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
                    deviceIds: utils.NON_EXISTING_ID
                },
                {
                    user: user,
                    actions: 'CreateDeviceCommand',
                    networkIds: networkId,
                    deviceIds: DEVICE_ID
                }
            ];

            utils.jwt.createMany(params, function (err, result) {
                if (err) {
                    return done(err);
                }

                invalidJWT1 = result[0];
                invalidJWT2 = result[1];
                invalidJWT3 = result[2];
                jwt = result[3];

                done();
            })
        });

        it('should fail with 403 #1', function (done) {
            var params = helper.getParamsObj(COMMAND);
            params.jwt = invalidJWT1;
            utils.create(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Access is denied');
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);

                done();
            });
        });

        it('should fail with 403 #2', function (done) {
            var params = helper.getParamsObj(COMMAND);
            params.jwt = invalidJWT2;
            utils.create(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Access is denied');
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);

                done();
            });
        });

        it('should fail with 403 #3', function (done) {
            var params = helper.getParamsObj(COMMAND);
            params.jwt = invalidJWT3;
            utils.create(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Access is denied');
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);

                done();
            });
        });

        it('should succeed when using valid jwt', function (done) {
            var params = helper.getParamsObj(COMMAND);
            params.jwt = jwt;
            utils.create(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(result.userId, user.id);

                done();
            });
        });

        it('should succeed when trying to create command with timestamp', function (done) {
            var timestamp = new Date().toISOString();
            var params = helper.getParamsObj(COMMAND, jwt, null, timestamp);
            utils.create(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(result.userId, user.id);
                var resultDate = new Date(result.timestamp).toISOString();
                assert.strictEqual(resultDate, timestamp);

                done();
            });
        });
    });

    describe('#Update', function () {

        var invalidJWT1 = null;
        var invalidJWT2 = null;
        var invalidJWT3 = null;
        var jwt = null;

        before(function (done) {

            var params = [
                {
                    user: nonNetworkUser,
                    actions: 'UpdateDeviceCommand'
                },
                {
                    user: user,
                    actions: 'UpdateDeviceCommand',
                    networkIds: [0]
                },
                {
                    user: user,
                    actions: 'UpdateDeviceCommand',
                    deviceIds: utils.NON_EXISTING_ID
                },
                {
                    user: user,
                    actions: 'UpdateDeviceCommand',
                    networkIds: networkId,
                    deviceIds: DEVICE_ID
                }
            ];

            utils.jwt.createMany(params, function (err, result) {
                if (err) {
                    return done(err);
                }

                invalidJWT1 = result[0];
                invalidJWT2 = result[1];
                invalidJWT3 = result[2];
                jwt = result[3];

                var params = helper.getParamsObj(COMMAND, utils.jwt.admin);
                utils.create(path.current, params, function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    commandId = result.id;
                    done();
                })
            })
        });

        it('should fail with 403 #1', function (done) {
            var params = helper.getParamsObj(COMMAND);
            params.jwt = invalidJWT1;
            params.id = commandId;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Access is denied');
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);

                done();
            });
        });

        it('should fail with 403 #2', function (done) {
            var params = helper.getParamsObj(COMMAND);
            params.jwt = invalidJWT2;
            params.id = commandId;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Access is denied');
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);

                done();
            });
        });

        it('should fail with 403 #3', function (done) {
            var params = helper.getParamsObj(COMMAND);
            params.jwt = invalidJWT3;
            params.id = commandId;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Access is denied');
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);

                done();
            });
        });

        it('should succeed when updating using valid access key', function (done) {
            var params = helper.getParamsObj(COMMAND);
            params.jwt = jwt;
            params.id = commandId;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), false, 'No error');
                done();
            });
        });
    });

    describe('#Delete', function () {
        it('should return error when trying to delete command', function (done) {
            var params = {jwt: utils.jwt.admin};
            params.id = commandId;
            utils.delete(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'HTTP 405 Method Not Allowed');
                assert.strictEqual(err.httpStatus, status.METHOD_NOT_ALLOWED);
                done();
            });
        })
    });

    describe('#Unauthorized', function () {

        describe('#No Authorization', function () {
            it('should return error when getting commands without authorization', function (done) {
                utils.get(path.current, {user: null}, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            });

            it('should return error when getting commands with refresh jwt', function (done) {
                utils.get(path.current, {user: user, jwt: utils.jwt.admin_refresh }, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            });

            it('should return error when accessing non-existing command without authorization', function (done) {
                var params = {user: null, id: utils.NON_EXISTING_ID };
                utils.get(path.current, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            });

            it('should return error when inserting command without authorization', function (done) {
                var params = helper.getParamsObj('the-command', null);
                utils.create(path.current, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            });

            it('should return error when updating non-existing command without authorization', function (done) {
                var params = helper.getParamsObj('the-command', null);
                params.id = utils.NON_EXISTING_ID;
                utils.update(path.current, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            });
        });
    });

    describe('#Not Found', function () {

        it('should return error when accessing non-existing command', function (done) {
            var params = {jwt: utils.jwt.admin, id: utils.NON_EXISTING_ID };
            utils.get(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, format('Command with id = %d not found',
                    utils.NON_EXISTING_ID));
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);
                done();
            })
        });

        it('should return error when updating non-existing command', function (done) {
            var params = helper.getParamsObj('the-command', utils.jwt.admin);
            params.id = utils.NON_EXISTING_ID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, format('Command with id = %d not found',
                    utils.NON_EXISTING_ID));
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);
                done();
            })
        })
    });

    after(function (done) {
        utils.clearDataJWT(done);
    });
});
