var assert = require('assert');
var async = require('async');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;

describe('REST API Device Unit', function () {
    this.timeout(90000);

    var helper = utils.device;

    var NETWORK = utils.getName('network-device');
    var OTHER_NETWORK = utils.getName('other-network');
    var DEVICE = utils.getName('device');
    var DEVICE_CLASS_VERSION = '1';
    var DEVICE_GUID = utils.getName('guid-111');
    var NETWORK_FOR_ADMIN = utils.getName('admin-with-network');

    var adminNetworkId = null;
    var networkId = null;
    var otherNetworkId = null;
    var user = null;
    var otherNetworkUser = null;
    var nonNetworkUser = null;
    var adminWithNetwork = null;
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
                callback();
            });
        }

        function createOtherNetwork(callback) {
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
                callback();
            });
        }

        function createNetworkForAdmin(callback) {
            var params = {
                jwt: utils.jwt.admin,
                data: {
                    name: NETWORK_FOR_ADMIN
                }
            };

            utils.create(path.NETWORK, params, function (err, result) {
                if (err) {
                    return callback(err);
                }

                adminNetworkId = result.id;
                callback();
            });
        }

        function createDeviceClass(callback) {
            var params = utils.deviceClass.getParamsObj(DEVICE, utils.jwt.admin, DEVICE_CLASS_VERSION, void 0, void 0, equipment);
            utils.create(path.DEVICE_CLASS, params, function (err, result) {
                if (err) {
                    return callback(err);
                }

                deviceClassId = result.id;
                callback();
            });
        }

        function createDevice(callback) {
            var params = helper.getParamsObj(DEVICE, utils.jwt.admin, {name: NETWORK}, {name: DEVICE, version: '1'});
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
            utils.createUser2(1, null, function (err, result) {
                if (err) {
                    return callback(err);
                }

                nonNetworkUser = result.user;
                callback();
            });
        }

        function createOtherNetworkUser(callback) {
            utils.createUser2(1, otherNetworkId, function (err, result) {
                if (err) {
                    return callback(err);
                }

                otherNetworkUser = result.user;
                callback();
            });
        }

        function createAdminWithNetwork(callback) {
            utils.createUser2(0, adminNetworkId, function (err, result) {
                if (err) {
                    return callback(err);
                }

                adminWithNetwork = result.user;
                callback();
            });
        }

        async.series([
            createNetwork,
            createOtherNetwork,
            createNetworkForAdmin,
            createDeviceClass,
            createDevice,
            createUser,
            createNonNetworkUser,
            createOtherNetworkUser,
            createAdminWithNetwork
        ], done);
    });

    describe('#Get All', function () {

        var jwt1 = null;
        var jwt2 = null;
        var jwt3 = null;

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
                },
                {
                    user: user,
                    actions: 'GetDevice',
                    networkIds: [networkId]
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

                    callback();
                })
            }

            async.series([
                createJWTs
            ], done);

        });

        it('should get device by name', function (done) {
            var params = {jwt: utils.jwt.admin};
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
            var params = {jwt: utils.jwt.admin};
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
            var params = {jwt: utils.jwt.admin};
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
            utils.get(path.current, {jwt: jwt3}, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true, 'Is array of 1 object');
                utils.matches(result[0], {
                    id: DEVICE_GUID
                });

                done();
            })
        });

        it('should get zero devices when using jwt with no access #1', function (done) {
            utils.get(path.current, {jwt: jwt1}, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isEmptyArray(result), true);

                done();
            })
        });

        it('should get zero devices when using jwt with no access #2', function (done) {
            utils.get(path.current, {jwt: jwt2}, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isEmptyArray(result), true);

                done();
            })
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
                    networkIds: [networkId],
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
                    networkIds: [networkId],
                    deviceIds: utils.NON_EXISTING_ID
                },
                {
                    user: user,
                    actions: 'GetDevice',
                    networkIds: [networkId],
                    deviceIds: [DEVICE_GUID]
                }
            ];

            function createJWTs(callback) {
                utils.jwt.createMany(params, function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    invalidJWT1 = result[0];
                    invalidJWT2 = result[1];
                    invalidJWT3 = result[2];
                    jwt = result[3];

                    callback();
                })
            }

            async.series([
                createJWTs
            ], done);

        });

        it('should fail with 404 #1', function (done) {
            var params = {jwt: invalidJWT1};
            params.id = DEVICE_GUID;
            utils.get(path.current, params, function (err) {
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);

                done();
            });
        });

        it('should fail with 404 #2', function (done) {
            var params = {jwt: invalidJWT2};
            params.id = DEVICE_GUID;
            utils.get(path.current, params, function (err) {
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);

                done();
            });
        });

        it('should fail with 404 #3', function (done) {
            var params = {jwt: invalidJWT3};
            params.id = DEVICE_GUID;
            utils.get(path.current, params, function (err) {
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);

                done();
            });
        });

        it('should succeed when using valid jwt', function (done) {
            var params = {jwt: jwt};
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

        var NEW_DEVICE = utils.getName('new-device');
        var NEW_DEVICE_GUID = utils.getName('guid-222');
        var jwt = null;

        before(function (done) {
            function createDevice(callback) {
                var params = helper.getParamsObj(NEW_DEVICE, utils.jwt.admin, {name: NETWORK}, {name: DEVICE, version: '1', offlineTimeout: 120});
                params.id = NEW_DEVICE_GUID;
                utils.update(path.current, params, function (err) {
                    callback(err);
                });
            }

            function createJWT(callback) {
                utils.jwt.create(user.id, 'GetDeviceNotification', networkId, NEW_DEVICE_GUID, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    jwt = result.accessToken;
                    callback()
                })
            }

            async.series([
                createDevice,
                createJWT
            ], done);
        });

        it('should return newly created device', function (done) {
            var params = {jwt: utils.jwt.admin};
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
            utils.get(path.NOTIFICATION.get(NEW_DEVICE_GUID), {jwt: jwt}, function (err, result) {
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
                            name: DEVICE
                        }
                    }
                });

                done();
            });
        });
    });

    describe('#Create Client', function () {

        var NEW_DEVICE = utils.getName('new-device-1');
        var NEW_DEVICE_GUID = utils.getName('guid-333');
        var nonNetworkJWT = null;
        var jwt = null;

        before(function (done) {

            var params = [
                {
                    user: nonNetworkUser,
                    actions: 'RegisterDevice'
                },
                {
                    user: user,
                    actions: 'RegisterDevice'
                }
            ];

            function createJWTs(callback) {
                utils.jwt.createMany(params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    nonNetworkJWT = result[0];
                    jwt = result[1];
                    callback();
                });
            }

            async.series([
                createJWTs
            ], done);
        });

        it('should fail device creation for invalid jwt', function (done) {
            var params = helper.getParamsObj(NEW_DEVICE, nonNetworkJWT, {name: NETWORK}, {name: DEVICE, version: '1'});
            params.id = NEW_DEVICE_GUID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'No access to network!');
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);
                done();
            });
        });

        it('should allow device creation for valid jwt', function (done) {
            var params = helper.getParamsObj(NEW_DEVICE, jwt, {name: NETWORK}, {name: DEVICE, version: '1'});
            params.id = NEW_DEVICE_GUID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), false, 'No error');

                var params = {jwt: utils.jwt.admin};
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

        var NETWORK_KEY = utils.getName('network-key');

        before(function (done) {
            var params = {
                jwt: utils.jwt.admin,
                data: {
                    key: NETWORK_KEY
                }
            };
            params.id = networkId;
            utils.update(path.NETWORK, params, function (err) {
                done(err);
            });
        });

        it('should fail when referencing network without network key', function (done) {
            var params = helper.getParamsObj(DEVICE, utils.jwt.admin, {name: NETWORK}, {name: DEVICE, version: '1'});
            params.id = DEVICE_GUID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Incorrect network key value');
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);
                done();
            });
        });

        it('should succeed when network key is passed', function (done) {
            var params = helper.getParamsObj(DEVICE, utils.jwt.admin, {name: NETWORK, key: NETWORK_KEY}, {name: DEVICE, version: '1'});
            params.id = DEVICE_GUID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), false, 'No error');

                var params = {jwt: utils.jwt.admin};
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

        after(function (done) {
            // Remove network key
            var params = {
                jwt: utils.jwt.admin,
                data: {
                    key: null
                }
            };
            params.id = networkId;
            utils.update(path.NETWORK, params, function (err) {
                done(err);
            });
        });
    });

    describe('#Create Auto Create (incl. Legacy Equipment)', function () {

        var NEW_DEVICE = utils.getName('new-device-auto-create');
        var NEW_DEVICE_CLASS = utils.getName('new-device-class-auto-create');
        var NEW_DEVICE_CLASS_VERSION = '2';
        var DEVICE_GUID = utils.getName('guid-444');
        var NEW_NETWORK = utils.getName('network-autocreate');
        var equipment = {
            name: "eq1",
            code: "eq1_code",
            type: "eq1_type"
        };

        it('should auto-create network and device class', function (done) {
            var params = helper.getParamsObj(NEW_DEVICE, utils.jwt.admin,
                {name: NEW_NETWORK},
                {
                    name: NEW_DEVICE_CLASS,
                    version: NEW_DEVICE_CLASS_VERSION,
                    equipment: [equipment]
                });
            params.id = DEVICE_GUID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), false, 'No error');

                var params = {jwt: utils.jwt.admin};
                params.id = DEVICE_GUID;
                utils.get(path.current, params, function (err, result) {

                    assert.strictEqual(!(!err), false, 'No error');
                    utils.matches(result, {
                        id: DEVICE_GUID,
                        name: NEW_DEVICE,
                        network: {
                            name: NEW_NETWORK
                        },
                        deviceClass: {
                            name: NEW_DEVICE_CLASS,
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

    describe('#Create Permanent', function () {

        var newEquipment = {
            name: "eq1",
            code: "eq1_code",
            type: "eq1_type"
        };

        before(function (done) {
            var params = {
                data: {
                    isPermanent: true
                }
            };
            params.jwt = utils.jwt.admin;
            params.id = deviceClassId;
            utils.update(path.DEVICE_CLASS, params, function () {
                done();
            });
        });

        it('should not change permanent device class', function (done) {
            var params = helper.getParamsObj(DEVICE, utils.jwt.admin,
                {name: NETWORK},
                {
                    name: DEVICE,
                    version: DEVICE_CLASS_VERSION,
                    offlineTimeout: 10,
                    equipment: [newEquipment]
                });
            params.id = DEVICE_GUID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), false, 'No error');

                var params = {jwt: utils.jwt.admin};
                params.id = deviceClassId;
                utils.get(path.DEVICE_CLASS, params, function (err, result) {

                    assert.strictEqual(!(!err), false, 'No error');

                    utils.matches(result, {
                        equipment: [
                            {
                                name: equipment.name,
                                code: equipment.code,
                                type: equipment.type
                            }
                        ]
                    });

                    done();
                });
            });
        });
    });

    describe('#Update', function () {

        var NEW_DEVICE_GUID = utils.getName('guid-555');

        before(function (done) {
            var params = helper.getParamsObj(utils.getName('dev-update-0'), utils.jwt.admin,
                {name: utils.getName('network-update-0')},
                {
                    name: utils.getName('dev-update-0'),
                    version: '1'
                });
            params.id = NEW_DEVICE_GUID;
            utils.update(path.current, params, function () {
                var params = {jwt: utils.jwt.admin};
                params.id = NEW_DEVICE_GUID;
                utils.get(path.current, params, function (err) {
                    if (err) {
                        done(err);
                    }
                    done();
                });
            });
        });

        it('should modify device, auto-create new network and device-class', function (done) {
            var params = helper.getParamsObj(utils.getName('new-device-update'), utils.jwt.admin,
                {
                    name: utils.getName('network-update'),
                    description: 'description'
                },
                {
                    name: utils.getName('new-device-class-update'),
                    equipment: [equipment]
                });
            params.data.status = 'updated';
            params.data.data = {key: 'value'};
            params.id = NEW_DEVICE_GUID;

            var expected = params.data;

            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), false, 'No error');

                var params = {jwt: utils.jwt.admin};
                params.id = NEW_DEVICE_GUID;
                utils.get(path.current, params, function (err, result) {

                    assert.strictEqual(!(!err), false, 'No error');
                    utils.matches(result, expected);

                    done();
                });
            });
        });
    });

    describe('#Update Partial', function () {

        var NEW_DEVICE_GUID = utils.getName('guid-666');
        var NEW_DEVICE = utils.getName('dev-update-1');
        var adminWithNetworkJWT = null;
        var nonNetworkUserJWT = null;

        before(function (done) {

            var params = [
                {
                    user: adminWithNetwork,
                    actions: '*'
                },
                {
                    user: nonNetworkUser,
                    actions: ['*']
                }
            ];

            function createDevice(callback) {
                var params = helper.getParamsObj(NEW_DEVICE, utils.jwt.admin,
                    {name: NETWORK},
                    {
                        name: DEVICE,
                        version: DEVICE_CLASS_VERSION
                    });
                params.id = NEW_DEVICE_GUID;
                utils.update(path.current, params, callback);
            }

            function createJWT(callback) {
                utils.jwt.createMany(params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    adminWithNetworkJWT = result[0];
                    nonNetworkUserJWT = result[1];
                    callback();
                });
            }

            async.series([
                createDevice,
                createJWT
            ], done);

        });

        it('should modify device status only', function (done) {
            var params = {jwt: adminWithNetworkJWT};
            params.data = {status: 'modified'};
            params.id = NEW_DEVICE_GUID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), false, 'No error');

                var params = {jwt: utils.jwt.admin};
                params.id = NEW_DEVICE_GUID;
                utils.get(path.current, params, function (err, result) {

                    assert.strictEqual(!(!err), false, 'No error');

                    utils.matches(result, {
                        id: NEW_DEVICE_GUID,
                        name: NEW_DEVICE,
                        status: 'modified',
                        network: {
                            name: NETWORK
                        },
                        deviceClass: {
                            name: DEVICE
                        }
                    });

                    done();
                });
            });
        });

        it('should fail with 412 when admin without assigned networks', function (done) {
            var params = {jwt: nonNetworkUserJWT};
            params.data = {status: 'modified'};
            params.id = NEW_DEVICE_GUID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'User has no networks assigned to him');
                assert.strictEqual(err.httpStatus, status.PRECONDITION_FAILED);
                done();
            });
        });
    });

    describe('#Update Device Auth', function () {

        var NEW_DEVICE_GUID = utils.getName('guid-777');
        var NEW_DEVICE = utils.getName('dev-update-2');
        var userJWT = null;

        before(function (done) {

            var params = [
                {
                    user: user,
                    actions: 'RegisterDevice'
                }
            ];

            function createDevice(callback) {
                var params = helper.getParamsObj(NEW_DEVICE, utils.jwt.admin,
                    {name: NETWORK},
                    {
                        name: DEVICE,
                        version: DEVICE_CLASS_VERSION
                    });
                params.id = NEW_DEVICE_GUID;
                utils.update(path.current, params, callback);
            }

            function createJWT(callback) {
                utils.jwt.createMany(params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    userJWT = result[0];
                    callback();
                });
            }

            async.series([
                createDevice,
                createJWT
            ], done);


        });

        it('should modify device status', function (done) {
            var params = {
                jwt: userJWT
            };
            params.data = {status: 'modified_device_auth'};
            params.id = NEW_DEVICE_GUID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), false, 'No error');

                var params = {jwt: utils.jwt.admin};
                params.id = NEW_DEVICE_GUID;
                utils.get(path.current, params, function (err, result) {

                    assert.strictEqual(!(!err), false, 'No error');

                    utils.matches(result, {
                        id: NEW_DEVICE_GUID,
                        name: NEW_DEVICE,
                        status: 'modified_device_auth',
                        network: {
                            name: NETWORK
                        },
                        deviceClass: {
                            name: DEVICE
                        }
                    });

                    done();
                });
            });
        });
    });

    describe('#Update Client Auth', function () {

        var otherNetworkUserJWT = null;
        var nonNetworkUserJWT = null;
        var invalidJWT = null;
        var jwt = null;

        var NEW_DEVICE_GUID = utils.getName('guid-888');
        var NEW_DEVICE = utils.getName('dev-update-3');

        before(function (done) {

            var params = [
                {
                    user: otherNetworkUser,
                    actions: 'RegisterDevice'
                },
                {
                    user: nonNetworkUser,
                    actions: 'RegisterDevice'
                },
                {
                    user: user,
                    actions: 'RegisterDevice',
                    deviceIds: utils.NON_EXISTING_ID
                },
                {
                    user: user,
                    actions: 'RegisterDevice'
                }
            ];

            function createDevice(callback) {
                var params = helper.getParamsObj(NEW_DEVICE, utils.jwt.admin,
                    {name: NETWORK},
                    {
                        name: NEW_DEVICE,
                        version: '1'
                    });
                params.id = NEW_DEVICE_GUID;
                utils.update(path.current, params, function () {
                    var params = {jwt: utils.jwt.admin};
                    params.id = NEW_DEVICE_GUID;
                    utils.get(path.current, params, callback);
                });
            }

            function createJWTs(callback) {
                utils.jwt.createMany(params, function (err, result) {
                    if (err) {
                        return done(err);
                    }
                    otherNetworkUserJWT = result[0];
                    nonNetworkUserJWT = result[1];
                    invalidJWT = result[2];
                    jwt = result[3];
                    callback();
                })
            }

            async.series([
                createDevice,
                createJWTs
            ], done);

        });

        it('should fail with 403 when updating with wrong jwt', function (done) {
            var params = {jwt: otherNetworkUserJWT};
            params.data = {status: 'modified'};
            params.id = NEW_DEVICE_GUID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'No access to device');
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);
                done();
            });
        });

        it('should fail with 412 when updating with jwt without networks', function (done) {
            var params = {jwt: nonNetworkUserJWT};
            params.data = {status: 'modified'};
            params.id = NEW_DEVICE_GUID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'User has no networks assigned to him');
                assert.strictEqual(err.httpStatus, status.PRECONDITION_FAILED);
                done();
            });
        });

        it('should modify device properties when accessing with allowed jwt', function (done) {
            var params = {jwt: jwt};
            params.data = {
                status: 'modified',
                data: {
                    par: 'value'
                },
                network: {
                    name: NETWORK
                },
                deviceClass: {
                    name: NEW_DEVICE,
                    version: '1',
                    offlineTimeout: 10
                }
            };
            params.id = NEW_DEVICE_GUID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), false, 'No error');

                var params = {jwt: utils.jwt.admin};
                params.id = NEW_DEVICE_GUID;
                utils.get(path.current, params, function (err, result) {

                    assert.strictEqual(!(!err), false, 'No error');

                    utils.matches(result, {
                        id: NEW_DEVICE_GUID,
                        name: NEW_DEVICE,
                        status: 'modified',
                        data: {
                            par: 'value'
                        },
                        network: {
                            name: NETWORK
                        },
                        deviceClass: {
                            name: NEW_DEVICE,
                            offlineTimeout: 10
                        }
                    });

                    done();
                });
            });
        });

        it('should succeed when using valid jwt', function (done) {
            var params = {jwt: jwt};
            params.data = {status: 'modified_jwt'};
            params.id = NEW_DEVICE_GUID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), false, 'No error');

                var params = {jwt: utils.jwt.admin};
                params.id = NEW_DEVICE_GUID;
                utils.get(path.current, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    utils.matches(result, {
                        id: NEW_DEVICE_GUID,
                        name: NEW_DEVICE,
                        status: 'modified_jwt',
                        network: {
                            name: NETWORK
                        },
                        deviceClass: {
                            name: NEW_DEVICE
                        }
                    });

                    done();
                });
            });
        });
    });

    describe('#Delete Client Auth', function () {

        var NEW_DEVICE_GUID = utils.getName('guid-999');
        var NEW_DEVICE = utils.getName('dev-update-4');

        var invalidJWT = null;
        var jwt = null;

        before(function (done) {

            var params = [
                {
                    user: nonNetworkUser,
                    actions: 'RegisterDevice'
                },
                {
                    user: user,
                    actions: 'RegisterDevice',
                    networkIds: [networkId],
                    deviceIds: [NEW_DEVICE_GUID]
                }
            ];

            function createDevice(callback) {
                var params = helper.getParamsObj(NEW_DEVICE, utils.jwt.admin,
                    {name: NETWORK},
                    {
                        name: DEVICE,
                        version: DEVICE_CLASS_VERSION
                    });
                params.id = NEW_DEVICE_GUID;
                utils.update(path.current, params, function (err) {
                    callback(err)
                });
            }

            function createJWTs(callback) {
                utils.jwt.createMany(params, function (err, result) {
                    if (err) {
                        return done(err);
                    }
                    invalidJWT = result[0];
                    jwt = result[1];
                    callback();
                })
            }

            async.series([
                createDevice,
                createJWTs
            ], done);


        });

        it('should return error when deleting device with invalid jwt', function (done) {
            var params = {jwt: invalidJWT};
            params.id = NEW_DEVICE_GUID;
            utils.delete(path.current, params, function (err) {
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                done();
            });
        });

        it('should succeed when deleting with allowed jwt', function (done) {
            var params = {jwt: jwt};
            params.id = NEW_DEVICE_GUID;
            utils.delete(path.current, params, function (err) {
                assert.strictEqual(!(!err), false, 'No error');

                var params = {jwt: utils.jwt.admin};
                params.id = NEW_DEVICE_GUID;
                utils.get(path.current, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error,
                        format('Device with such guid = %s not found', NEW_DEVICE_GUID));
                    assert.strictEqual(err.httpStatus, status.NOT_FOUND);

                    done();
                });
            });
        });
    });


    describe('#Bad Request', function () {

        var NEW_DEVICE_GUID = utils.getName('guid-1111');

        it('should fail with 400 when trying to create device with badly formed request #1', function (done) {
            var params = {jwt: utils.jwt.admin};
            params.data = {network: 'invalid', wrongProp: utils.getName('bad-request')};
            params.id = NEW_DEVICE_GUID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.httpStatus, status.BAD_REQUEST);

                done();
            });
        });

        it('should fail with 400 when trying to create device with badly formed request #2', function (done) {
            var params = helper.getParamsObj(utils.getName('bad-request'), utils.jwt.admin);
            params.id = NEW_DEVICE_GUID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.httpStatus, status.BAD_REQUEST);

                done();
            });
        });

        it('should fail with 400 when trying to create device with badly formed request #3', function (done) {
            var params = helper.getParamsObj(utils.getName('bad-request'), utils.jwt.admin, 'invalid', {name: utils.getName('bad-request')});
            params.id = NEW_DEVICE_GUID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.httpStatus, status.BAD_REQUEST);

                done();
            });
        });
    });

    describe('#Unauthorized', function () {

        describe('#No Authorization', function () {

            it('should return error when getting devices without jwt', function (done) {
                utils.get(path.current, {jwt: null}, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            });

            it('should return error when accessing device without jwt', function (done) {
                var params = {jwt: null};
                params.id = DEVICE_GUID;
                utils.get(path.current, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            });

            it('should return error when updating device without jwt', function (done) {
                var params = {jwt: null};
                params.data = {status: 'modified'};
                params.id = DEVICE_GUID;
                utils.update(path.current, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            });

            it('should return error when deleting device without jwt', function (done) {
                var params = {jwt: null};
                params.id = DEVICE_GUID;
                utils.delete(path.current, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            });
        });

    });

    describe('#Not Found', function () {

        it('should return error when accessing non-existing device', function (done) {
            var params = {jwt: utils.jwt.admin};
            params.id = utils.NON_EXISTING_ID;
            utils.get(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error,
                    format('Device with such guid = %s not found',
                        utils.NON_EXISTING_ID));
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);
                done();
            })
        });
    });

    after(function (done) {
        utils.clearDataJWT(done);
    });
});
