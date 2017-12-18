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
    var NETWORK2 = utils.getName('network-device2');
    var OTHER_NETWORK = utils.getName('other-network');
    var DEVICE = utils.getName('device');
    var DEVICE_ID = utils.getName('id-111');
    var NETWORK_FOR_ADMIN = utils.getName('admin-with-network');

    var adminNetworkId = null;
    var networkId = null;
    var networkId2 = null;
    var otherNetworkId = null;
    var user = null;
    var otherNetworkUser = null;
    var nonNetworkUser = null;
    var adminWithNetwork = null;

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

        function createNetwork2(callback) {
            var params = {
                jwt: utils.jwt.admin,
                data: {
                    name: NETWORK2
                }
            };

            utils.create(path.NETWORK, params, function (err, result) {
                if (err) {
                    return callback(err);
                }

                networkId2 = result.id;
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

        function createDevice(callback) {
            var params = helper.getParamsObj(DEVICE, utils.jwt.admin, networkId, {name: DEVICE, version: '1'});
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

        function createUserNetwork2(callback) {
            var params = {
                jwt: utils.jwt.admin
            };

            utils.update(path.USER + "/" + user.id + path.NETWORK + "/" + networkId2, params, function (err, result) {
                if (err) {
                    return callback(err);
                }

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
            createNetwork2,
            createOtherNetwork,
            createNetworkForAdmin,
            createDevice,
            createUser,
            createUserNetwork2,
            createNonNetworkUser,
            createOtherNetworkUser,
            createAdminWithNetwork
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
                    actions: 'GetDevice',
                    deviceTypeIds: ['*'],
                    networkIds: [0]
                },
                {
                    user: user,
                    actions: 'GetDevice',
                    deviceTypeIds: ['*'],
                    deviceIds: utils.NON_EXISTING_ID
                },
                {
                    user: user,
                    actions: 'GetDevice',
                    networkIds: [networkId],
                    deviceTypeIds: ['*'],
                    deviceIds: ["*"]
                },
                {
                    user: user,
                    actions: 'GetDevice',
                    networkIds: [],
                    deviceTypeIds: ['*'],
                    deviceIds: []
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
                    id: DEVICE_ID
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
                    id: DEVICE_ID
                });

                done();
            })
        });

        it('should get all devices', function (done) {
            utils.get(path.current, {jwt: jwt3}, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                console.log(result);
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true, 'Is array of 1 object');
                utils.matches(result[0], {
                    id: DEVICE_ID
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

        it('should get zero devices when using jwt with no access #3', function (done) {
            utils.get(path.current, {jwt: jwt4}, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isEmptyArray(result), true);

                done();
            })
        });
    });

    describe('#Get', function () {

        var invalidJWT1 = null;
        var invalidJWT2 = null;
        var invalidDeviceId = 'invalid-device-id';

        var jwt = null;
        var allNetworksJwt = null;

        before(function (done) {
            var params = [
                {
                    user: nonNetworkUser,
                    networkIds: [networkId],
                    deviceTypeIds: ['*'],
                    actions: 'GetDevice'
                },
                {
                    user: user,
                    actions: 'GetDevice',
                    deviceTypeIds: ['*'],
                    networkIds: [0]
                },
                {
                    user: user,
                    actions: 'GetDevice',
                    networkIds: [networkId],
                    deviceTypeIds: ['*'],
                    deviceIds: [DEVICE_ID]
                },
                {
                    user: user,
                    actions: 'GetDevice',
                    networkIds: ['*'],
                    deviceTypeIds: ['*'],
                    deviceIds: [DEVICE_ID]
                }
            ];

            function createJWTs(callback) {
                utils.jwt.createMany(params, function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    invalidJWT1 = result[0];
                    invalidJWT2 = result[1];
                    jwt = result[2];
                    allNetworksJwt = result[3];

                    callback();
                })
            }

            async.series([
                createJWTs
            ], done);

        });

        it('should fail with 403 #1', function (done) {
            var params = {jwt: invalidJWT1};
            params.id = DEVICE_ID;
            utils.get(path.current, params, function (err) {
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);

                done();
            });
        });

        it('should fail with 403 #2', function (done) {
            var params = {jwt: invalidJWT2};
            params.id = DEVICE_ID;
            utils.get(path.current, params, function (err) {
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);

                done();
            });
        });

        it('should fail with 404 when no device exists', function (done) {
            var params = {jwt: utils.jwt.admin};
            params.id = invalidDeviceId;
            utils.get(path.current, params, function (err) {
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);

                done();
            });
        });

        it('should succeed when using valid jwt #1', function (done) {
            var params = {jwt: jwt};
            params.id = DEVICE_ID;
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(result.id, DEVICE_ID);
                assert.strictEqual(result.name, DEVICE);

                done();
            });
        });

        it('should succeed when using valid jwt #2', function (done) {
            var params = {jwt: allNetworksJwt};
            params.id = DEVICE_ID;
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(result.id, DEVICE_ID);
                assert.strictEqual(result.name, DEVICE);

                done();
            });
        });
    });

    describe('#Create', function () {

        var NEW_DEVICE = utils.getName('new-device');
        var NEW_DEVICE_ID = utils.getName('id-222');
        var jwt = null;

        before(function (done) {
            function createDevice(callback) {
                var params = helper.getParamsObj(NEW_DEVICE, utils.jwt.admin, networkId, {name: DEVICE});
                params.id = NEW_DEVICE_ID;
                utils.update(path.current, params, function (err) {
                    callback(err);
                });
            }

            function createJWT(callback) {
                utils.jwt.create(user.id, 'GetDeviceNotification', networkId, ['*'], function (err, result) {
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
            params.id = NEW_DEVICE_ID;
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                utils.matches(result, {
                    id: NEW_DEVICE_ID,
                    name: NEW_DEVICE,
                    networkId: networkId
                });

                done();
            });
        });

        it('should verify device-add notification', function (done) {
            utils.get(path.NOTIFICATION.get(NEW_DEVICE_ID), {jwt: jwt}, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true, 'Is array of 1 object');
                utils.matches(result[0], {
                    notification: '$device-add',
                    parameters: {
                        id: NEW_DEVICE_ID,
                        name: NEW_DEVICE,
                        networkId: networkId
                    }
                });

                done();
            });
        });
    });

    describe('#Create', function () {

        var NEW_DEVICE = utils.getName('new-device');
        var NEW_DEVICE_ID = utils.getName('id-222');
        var jwt = null;

        before(function (done) {
        	function createJWT(callback) {
        		utils.jwt.create(user.id, ['*'], networkId, ['*'], function (err, result) {
        			if (err) {
        				return callback(err);
        			}
        			jwt = result.accessToken;
        			callback()
        		})
        	}

            function createDevice(callback) {
                var params = helper.getParamsObj(NEW_DEVICE, jwt, null, {name: DEVICE});
                params.id = NEW_DEVICE_ID;
                utils.update(path.current, params, function (err) {
                    callback(err);
                });
            }

            async.series([
            	createJWT,
                createDevice
            ], done);
        });

        it('should return newly created device with the default network ID', function (done) {
            var params = {jwt: utils.jwt.admin};
            params.id = NEW_DEVICE_ID;
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                utils.matches(result, {
                    id: NEW_DEVICE_ID,
                    name: NEW_DEVICE,
                    networkId: networkId
                });

                done();
            });
        });

    });

    describe('#Create Client', function () {

        var NEW_DEVICE = utils.getName('new-device-1');
        var NEW_DEVICE_ID = utils.getName('id-333');
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
                    deviceTypeIds: ['*'],
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
            var params = helper.getParamsObj(NEW_DEVICE, nonNetworkJWT, networkId, {name: DEVICE});
            params.id = NEW_DEVICE_ID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'No access to network!');
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);
                done();
            });
        });

        it('should allow device creation for valid jwt', function (done) {
            var params = helper.getParamsObj(NEW_DEVICE, jwt, networkId, {name: DEVICE});
            params.id = NEW_DEVICE_ID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), false, 'No error');

                var params = {jwt: utils.jwt.admin};
                params.id = NEW_DEVICE_ID;
                utils.get(path.current, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    utils.matches(result, {
                        id: NEW_DEVICE_ID,
                        name: NEW_DEVICE,
                        networkId: networkId
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

        after(function (done) {
            // Remove network key
            var params = {
                jwt: utils.jwt.admin,
                data: {
                    key: ""
                }
            };
            params.id = networkId;
            utils.update(path.NETWORK, params, function (err) {
                done(err);
            });
        });
    });

    describe('#Update Device Auth', function () {

        var NEW_DEVICE_ID = utils.getName('id-777');
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
                var params = helper.getParamsObj(NEW_DEVICE, utils.jwt.admin, networkId);
                params.id = NEW_DEVICE_ID;
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
    });

    describe('#Update Client Auth', function () {

        var otherNetworkUserJWT = null;
        var nonNetworkUserJWT = null;
        var invalidJWT = null;
        var jwt = null;

        var NEW_DEVICE_ID = utils.getName('guid-888');
        var NEW_DEVICE = utils.getName('dev-update-3');

        before(function (done) {

            var params = [
                {
                    user: otherNetworkUser,
                    actions: 'RegisterDevice',
                    deviceTypeIds: ['*']
                },
                {
                    user: nonNetworkUser,
                    actions: 'RegisterDevice',
                    deviceTypeIds: ['*']
                },
                {
                    user: user,
                    actions: 'RegisterDevice',
                    deviceTypeIds: ['*'],
                    deviceIds: utils.NON_EXISTING_ID
                },
                {
                    user: user,
                    actions: 'RegisterDevice',
                    deviceTypeIds: ['*']
                }
            ];

            function createDevice(callback) {
                var params = helper.getParamsObj(NEW_DEVICE, utils.jwt.admin,
                    networkId,
                    {
                        name: NEW_DEVICE,
                        version: '1'
                    });
                params.id = NEW_DEVICE_ID;
                utils.update(path.current, params, function () {
                    var params = {jwt: utils.jwt.admin};
                    params.id = NEW_DEVICE_ID;
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
            params.id = NEW_DEVICE_ID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'No access to device');
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);
                done();
            });
        });

        it('should modify device properties when accessing with allowed jwt', function (done) {
            var params = {jwt: jwt};
            params.data = {
                data: {
                    par: 'value'
                },
                networkId: networkId
            };
            params.id = NEW_DEVICE_ID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), false, 'No error');

                var params = {jwt: utils.jwt.admin};
                params.id = NEW_DEVICE_ID;
                utils.get(path.current, params, function (err, result) {

                    assert.strictEqual(!(!err), false, 'No error');

                    utils.matches(result, {
                        id: NEW_DEVICE_ID,
                        name: NEW_DEVICE,
                        data: {
                            par: 'value'
                        },
                        networkId: networkId
                    });

                    done();
                });
            });
        });

        it('should succeed when using valid jwt', function (done) {
            var params = {jwt: jwt};
            params.data = {};
            params.id = NEW_DEVICE_ID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), false, 'No error');

                var params = {jwt: utils.jwt.admin};
                params.id = NEW_DEVICE_ID;
                utils.get(path.current, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    utils.matches(result, {
                        id: NEW_DEVICE_ID,
                        name: NEW_DEVICE,
                        networkId: networkId
                    });

                    done();
                });
            });
        });
    });

    describe('#Delete Client Auth', function () {

        var NEW_DEVICE_ID = utils.getName('guid-999');
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
                    deviceTypeIds: ['*'],
                    deviceIds: [NEW_DEVICE_ID]
                }
            ];

            function createDevice(callback) {
                var params = helper.getParamsObj(NEW_DEVICE, utils.jwt.admin, networkId);
                params.id = NEW_DEVICE_ID;
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
            params.id = NEW_DEVICE_ID;
            utils.delete(path.current, params, function (err) {
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);
                done();
            });
        });

        it('should succeed when deleting with allowed jwt', function (done) {
            var params = {jwt: jwt};
            params.id = NEW_DEVICE_ID;
            utils.delete(path.current, params, function (err) {
                assert.strictEqual(!(!err), false, 'No error');

                var params = {jwt: utils.jwt.admin};
                params.id = NEW_DEVICE_ID;
                utils.get(path.current, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error,
                        format('Device with such deviceId = %s not found', NEW_DEVICE_ID));
                    assert.strictEqual(err.httpStatus, status.NOT_FOUND);

                    done();
                });
            });
        });
    });

    describe('#Get device with client jwt', function () {

        var NEW_DEVICE_ID = utils.getName('guid-999');
        var NEW_DEVICE = utils.getName('dev-update-4');

        var jwt = null;
        var invalidJwt = null;

        before(function (done) {

            var params = [
                {
                    user: user,
                    actions: 'GetDevice',
                    deviceTypeIds: ['*'],
                    networkIds: [networkId],
                    deviceIds: ['*'] // Allow all devices for user
                },
                {
                    user: user,
                    actions: 'GetDevice',
                    networkIds: [networkId]
                }
            ];

            function createDevice(callback) {
                var params = helper.getParamsObj(NEW_DEVICE, utils.jwt.admin, networkId);
                params.id = NEW_DEVICE_ID;
                utils.update(path.current, params, function (err) {
                    callback(err)
                });
            }

            function createJWT(callback) {
                utils.jwt.createMany(params, function (err, result) {
                    if (err) {
                        return done(err);
                    }
                    jwt = result[0];
                    invalidJwt = result[1];
                    callback();
                })
            }

            async.series([
                createDevice,
                createJWT
            ], done);

        });

        it('should return device', function (done) {
            var params = {jwt: jwt};
            params.id = NEW_DEVICE_ID;
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(result.id, NEW_DEVICE_ID);
                done();
            });
        });
        it('should return access is denied error', function (done) {
            var params = {jwt: invalidJwt};
            params.id = NEW_DEVICE_ID;
            utils.get(path.current, params, function (err) {
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);
                done();
            });
        });
    });


    describe('#Bad Request', function () {

        var NEW_DEVICE_ID = utils.getName('guid-1111');
        var ILLEGAL_DEVICE_ID_1 = 'comma,test';
        var ILLEGAL_DEVICE_ID_2 = '$pecial_symbol&test';
        var ILLEGAL_DEVICE_ID_3 = 'm*!t1s1#bo!_test';

        it('should fail with 400 when trying to create device with badly formed request #1', function (done) {
            var params = {jwt: utils.jwt.admin};
            params.data = {networkId: 'invalid', wrongProp: utils.getName('bad-request')};
            params.id = NEW_DEVICE_ID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.httpStatus, status.BAD_REQUEST);

                done();
            });
        });

        it('should fail with 400 when trying to create device with badly formed request #2', function (done) {
            var params = helper.getParamsObj(utils.getName('bad-request'), utils.jwt.admin, 'invalid');
            params.id = NEW_DEVICE_ID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.httpStatus, status.BAD_REQUEST);

                done();
            });
        });

        it('should fail with 400 when trying to create device with badly formed request #3', function (done) {
            var params = helper.getParamsObj(utils.getName('bad-request'), utils.jwt.admin, 'invalid', {name: utils.getName('bad-request')});
            params.id = NEW_DEVICE_ID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.httpStatus, status.BAD_REQUEST);

                done();
            });
        });

        it('should fail with 400 when trying to create device with badly formed request #4', function (done) {
            var params = {jwt: utils.jwt.admin};
            params.id = ILLEGAL_DEVICE_ID_1;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.httpStatus, status.BAD_REQUEST);

                done();
            });
        });

        it('should fail with 400 when trying to create device with badly formed request #5', function (done) {
            var params = {jwt: utils.jwt.admin};
            params.id = ILLEGAL_DEVICE_ID_2;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.httpStatus, status.BAD_REQUEST);

                done();
            });
        });

        it('should fail with 400 when trying to create device with badly formed request #6', function (done) {
            var params = {jwt: utils.jwt.admin};
            params.id = ILLEGAL_DEVICE_ID_3;
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

            it('should return error when getting devices with refresh jwt', function (done) {
                utils.get(path.current, {jwt: utils.jwt.admin_refresh}, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            });

            it('should return error when accessing device without jwt', function (done) {
                var params = {jwt: null};
                params.id = DEVICE_ID;
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
                params.id = DEVICE_ID;
                utils.update(path.current, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            });

            it('should return error when deleting device without jwt', function (done) {
                var params = {jwt: null};
                params.id = DEVICE_ID;
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
                    format('Device with such deviceId = %s not found',
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
