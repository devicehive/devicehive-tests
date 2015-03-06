var assert = require('assert');
var async = require('async');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;

describe('REST API Device Unit', function () {
    this.timeout(30000);

    var helper = utils.device;

    var NETWORK = '_integr-test-network-device';
    var DEVICE = '_integr-test-device';
    var DEVICE_CLASS_VERSION = '1';
    var DEVICE_GUID = 'INTEGR-TEST-DEVICE-GUID-12345';
    var DEVICE_KEY = 'INTEGR-TEST-DEVICE-KEY-1';

    var networkId = null;
    var user = null;
    var nonNetworkUser = null;
    var deviceClassId = null;
    var equipment = {
        name: "_integr-test-eq",
        code: "123",
        type: "_integr-test-type"
    };

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
            var params = utils.deviceClass.getParamsObj(DEVICE, utils.admin, DEVICE_CLASS_VERSION, void 0, void 0, equipment);
            utils.create(path.DEVICE_CLASS, params, function (err, result) {
                if (err) {
                    return callback(err);
                }

                deviceClassId = result.id;
                callback();
            });
        }

        function createDevice(callback) {
            var params = helper.getParamsObj(DEVICE, utils.admin, DEVICE_KEY,
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

        async.series([
            createNetwork,
            createDeviceClass,
            createDevice,
            createUser,
            createNonNetworkUser
        ], done);
    });

    describe('#GetAll', function () {

        var accessKey1 = null;
        var accessKey2 = null;

        before(function (done) {
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
                    return done(err);
                }

                accessKey1 = result[0];
                accessKey2 = result[1];

                done();
            });
        });

        it('should get device by name', function (done) {
            var params = {user: utils.admin};
            params.query = path.query('name', DEVICE);
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true, 'Is array of 1 object');
                utils.matches(result[0], {
                    id: DEVICE_GUID
                });

                done();
            })
        });

        it('should get device by network', function (done) {
            var params = {user: utils.admin};
            params.query = path.query('networkId', networkId);
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true, 'Is array of 1 object');
                utils.matches(result[0], {
                    id: DEVICE_GUID
                });

                done();
            })
        });

        it('should get device by device class', function (done) {
            var params = {user: utils.admin};
            params.query = path.query('deviceClassId', deviceClassId);
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true, 'Is array of 1 object');
                utils.matches(result[0], {
                    id: DEVICE_GUID
                });

                done();
            })
        });

        it('should get all devices', function (done) {
            utils.get(path.current, {user: user}, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true, 'Is array of 1 object');
                utils.matches(result[0], {
                    id: DEVICE_GUID
                });

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
                    return done(err);
                }

                invalidAccessKey1 = result[0];
                invalidAccessKey2 = result[1];
                invalidAccessKey3 = result[2];
                accessKey = result[3];

                done();
            });
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

    describe('#Create', function () {

        var NEW_DEVICE = '_integr-test-new-device';
        var NEW_DEVICE_GUID = 'INTEGR-TEST-NEW-DEVICE-GUID-12345';

        before(function (done) {
            var params = helper.getParamsObj(NEW_DEVICE, utils.admin, DEVICE_KEY,
                {name: NETWORK}, {name: DEVICE, version: '1'});
            params.id = NEW_DEVICE_GUID;
            utils.update(path.current, params, function (err) {
                done(err);
            });
        });

        it('should return newly created device', function (done) {
            var params = {user: utils.admin};
            params.id = NEW_DEVICE_GUID;
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                utils.matches(result, {
                    id: NEW_DEVICE_GUID,
                    name: NEW_DEVICE,
                    network: {
                        id: networkId,
                        name: NETWORK
                    },
                    deviceClass: {
                        name: DEVICE,
                        version: DEVICE_CLASS_VERSION,
                        equipment: [
                            {
                                name: equipment.name,
                                code: equipment.code,
                                type: equipment.type
                            }
                        ]
                    }
                });

                done();
            });
        });

        it('should verify device-add notification', function (done) {
            utils.get(path.NOTIFICATION.get(NEW_DEVICE_GUID), {user: user}, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true, 'Is array of 1 object');
                utils.matches(result[0], {
                    notification: '$device-add',
                    parameters: {
                        id: NEW_DEVICE_GUID,
                        name: NEW_DEVICE,
                        network: {
                            id: networkId,
                            name: NETWORK
                        },
                        deviceClass: {
                            id: deviceClassId,
                            name: DEVICE,
                            version: DEVICE_CLASS_VERSION
                        }
                    }
                });

                done();
            });
        });
    });

    describe('#Create Client', function () {

        var NEW_DEVICE = '_integr-test-new-device-1';
        var NEW_DEVICE_GUID = 'INTEGR-TEST-NEW-DEVICE-GUID-12345-1';

        it('should fail device creation for invalid user', function (done) {
            var params = helper.getParamsObj(NEW_DEVICE, nonNetworkUser, DEVICE_KEY,
                {name: NETWORK}, {name: DEVICE, version: '1'});
            params.id = NEW_DEVICE_GUID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'DeviceHive server error - No access to network!');
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);
                done();
            });
        });

        it('should allow device creation for valid user', function (done) {
            var params = helper.getParamsObj(NEW_DEVICE, user, DEVICE_KEY,
                {name: NETWORK}, {name: DEVICE, version: '1'});
            params.id = NEW_DEVICE_GUID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), false, 'No error');

                var params = {user: utils.admin};
                params.id = NEW_DEVICE_GUID;
                utils.get(path.current, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    utils.matches(result, {
                        id: NEW_DEVICE_GUID,
                        name: NEW_DEVICE,
                        network: {
                            id: networkId,
                            name: NETWORK
                        },
                        deviceClass: {
                            name: DEVICE,
                            version: DEVICE_CLASS_VERSION,
                            equipment: [
                                {
                                    name: equipment.name,
                                    code: equipment.code,
                                    type: equipment.type
                                }
                            ]
                        }
                    });

                    done();
                });
            });
        });
    });

    describe('#Create Network Key', function () {

        var NETWORK_KEY = 'INTEGR-TEST-NETWORK-KEY-12345';

        before(function (done) {
            // Set a key to the network
            var params = {
                user: utils.admin,
                data: {
                    key: NETWORK_KEY
                }
            };
            params.id = networkId;
            utils.update(path.NETWORK, params, function (err, result) {
                done(err);
            });
        });

        it('should fail when referencing network without key', function (done) {
            var params = helper.getParamsObj(DEVICE, null, DEVICE_KEY,
                {name: NETWORK}, {name: DEVICE, version: '1'});
            params.id = DEVICE_GUID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'DeviceHive server error - Incorrect network key value');
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);
                done();
            });
        });

        it('should succeed when network key is passed', function (done) {
            var params = helper.getParamsObj(DEVICE, null, DEVICE_KEY,
                {name: NETWORK, key: NETWORK_KEY}, {name: DEVICE, version: '1'});
            params.id = DEVICE_GUID;
            utils.update(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');

                var params = {user: utils.admin};
                params.id = DEVICE_GUID;
                utils.get(path.current, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    utils.matches(result, {
                        id: DEVICE_GUID,
                        name: DEVICE,
                        network: {
                            id: networkId,
                            name: NETWORK,
                            key: NETWORK_KEY
                        },
                        deviceClass: {
                            name: DEVICE,
                            version: DEVICE_CLASS_VERSION,
                            equipment: [
                                {
                                    name: equipment.name,
                                    code: equipment.code,
                                    type: equipment.type
                                }
                            ]
                        }
                    });

                    done();
                });
            });
        });

        it('should not expose network key to devices', function (done) {
            var params = {
                device: {
                    id: DEVICE_GUID,
                    key: DEVICE_KEY
                }
            };
            params.id = DEVICE_GUID;
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(!(!result.network), true);
                assert.strictEqual(!(!result.network.key), false);
                done();
            });
        });
    });

    describe('#Create Auto Create (incl. Legacy Equipment)', function () {

        var NEW_DEVICE = '_integr-test-new-device-auto-create';
        var NEW_DEVICE_CLASS = '_integr-test-new-device-class-auto-create';
        var NEW_DEVICE_CLASS_VERSION = '2';
        var DEVICE_GUID = 'INTEGR-TEST-AUTOCREATE-DEVICE-GUID-12345-2';
        var NEW_NETWORK = '_integr-test-network-autocreate';
        var equipment = {
            name: "eq1",
            code: "eq1_code",
            type: "eq1_type"
        };

        it('should auto-create network and device class', function (done) {
            var params = helper.getParamsObj(NEW_DEVICE, null, DEVICE_KEY,
                {name: NEW_NETWORK},
                {
                    name: NEW_DEVICE_CLASS,
                    version: NEW_DEVICE_CLASS_VERSION,
                    equipment: [equipment]
                });
            params.id = DEVICE_GUID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), false, 'No error');

                var params = {user: utils.admin};
                params.id = DEVICE_GUID;
                utils.get(path.current, params, function (err, result) {

                    utils.resources.push(path.get(path.NETWORK, result.network.id));
                    utils.resources.push(path.get(path.DEVICE_CLASS, result.deviceClass.id));

                    assert.strictEqual(!(!err), false, 'No error');
                    utils.matches(result, {
                        id: DEVICE_GUID,
                        name: NEW_DEVICE,
                        network: {
                            name: NEW_NETWORK
                        },
                        deviceClass: {
                            name: NEW_DEVICE_CLASS,
                            version: NEW_DEVICE_CLASS_VERSION,
                            equipment: [
                                {
                                    name: equipment.name,
                                    code: equipment.code,
                                    type: equipment.type
                                }
                            ]
                        }
                    });

                    done();
                });
            });
        });
    });

    after(function (done) {
        utils.clearResources(done);
    });
});