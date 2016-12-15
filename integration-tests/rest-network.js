var async = require('async');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;
var req = require('./common/request');

describe('REST API Network', function () {
    this.timeout(90000);

    var NETWORK_1 = utils.getName('network-1');
    var NETWORK_2 = utils.getName('network-2');
    var NETWORK_KEY = utils.getName('network-key');
    var networkId1 = null;
    var networkId2 = null;
    var user = null;
    var nonNetworkUser = null;

    before(function (done) {
        path.current = path.NETWORK;

        function createNetwork1(callback) {
            var params = {
                jwt: utils.jwt.admin,
                data: { name: NETWORK_1, key: NETWORK_KEY }
            };

            utils.create(path.NETWORK, params, function (err, result) {
                if (err) {
                    return callback(err);
                }

                networkId1 = result.id;
                callback();
            });
        }

        function createNetwork2(callback) {
            var params = {
                jwt: utils.jwt.admin,
                data: { name: NETWORK_2, key: NETWORK_KEY }
            };

            utils.create(path.NETWORK, params, function (err, result) {
                if (err) {
                    return callback(err);
                }

                networkId2 = result.id;
                callback();
            });
        }

        function createUser(callback) {
            utils.createUser2(1, networkId1, function (err, result) {
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
            createNetwork1,
            createNetwork2,
            createUser,
            createNonNetworkUser
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
                    actions: 'GetNetwork'
                },
                {
                    user: user,
                    actions: 'GetNetwork',
                    networkIds: [0]
                },
                {
                    user: user,
                    actions: 'GetNetwork',
                    networkIds: [networkId1]
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
                });
            }

            async.series([
                createJWTs
            ], done);
        });

        it('should get all networks for admin jwt', function (done) {
            req.get(path.current)
                .params({jwt: utils.jwt.admin})
                .expectTrue(function (result) {
                    return utils.core.isArrayNonEmpty(result);
                })
                .expectTrue(function (result) {
                    return result.some(function (item) {
                        return item.id === networkId1;
                    });
                })
                .expectTrue(function (result) {
                    return result.some(function (item) {
                        return item.id === networkId2;
                    });
                })
                .send(done);
        });

        it('should get network by name for admin jwt', function (done) {
            req.get(path.current)
                .params({jwt: utils.jwt.admin})
                .query('name', NETWORK_1)
                .expect([{id: networkId1, name: NETWORK_1, key: NETWORK_KEY}])
                .send(done);
        });

        it('should get all networks', function (done) {
            req.get(path.current)
                .params({jwt: jwt1})
                .expect([{id: networkId1, name: NETWORK_1, key: NETWORK_KEY}])
                .send(done);
        });

        it('should get none of networks', function (done) {
            req.get(path.current)
                .params({jwt: jwt2})
                .expectTrue(function (result) {
                    return utils.core.isEmptyArray(result);
                })
                .send(done);
        });

        it('should get network', function (done) {
            req.get(path.current)
                .params({jwt: jwt3})
                .expect([{id: networkId1, name: NETWORK_1, key: NETWORK_KEY}])
                .send(done);
        });
    });

    describe('#Get', function () {

        var jwt1 = null;
        var jwt2 = null;
        var jwt3 = null;
        var jwt4 = null;

        before(function (done) {
            var params = [
                {
                    user: nonNetworkUser,
                    actions: 'GetNetwork'
                },
                {
                    user: user,
                    actions: 'GetNetwork',
                    networkIds: [0]
                },
                {
                    user: user,
                    actions: 'GetNetwork'
                },
                {
                    user: user,
                    actions: 'GetNetwork',
                    networkIds: [networkId1]
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
                });
            }

            async.series([
                createJWTs
            ], done);
        });

        it('should fail with 401 when getting with non-network user', function (done) {
            req.get(path.current)
                .params({jwt: jwt1, id: networkId1})
                .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                .send(done);
        });

        it('should fail with 401 #1', function (done) {
            req.get(path.current)
                .params({jwt: jwt1, id: networkId1})
                .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                .send(done);
        });

        it('should fail with 401 #2', function (done) {
            req.get(path.current)
                .params({jwt: jwt2, id: networkId1})
                .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                .send(done);
        });

        it('should succeed when getting network using valid jwt', function (done) {
            req.get(path.current)
                .params({jwt: jwt4, id: networkId1})
                .expect({id: networkId1, name: NETWORK_1, key: NETWORK_KEY})
                .send(done);
        });
    });

    describe('#Create', function () {

        it('should create network using admin jwt', function (done) {
            var network = {name: utils.getName('network-3'), key: NETWORK_KEY};

            req.create(path.current)
                .params({jwt: utils.jwt.admin, data: network})
                .send(function (err, result) {
                    if (err) {
                        done(err);
                    }

                    req.get(path.current)
                        .params({jwt: utils.jwt.admin, id: result.id})
                        .expect(network)
                        .send(done);
                });
        });
    });

    describe('#Create Existing', function () {

        it('should fail with 403 when trying to create existing network', function (done) {
            req.create(path.current)
                .params({jwt: utils.jwt.admin, data: {name: NETWORK_1}})
                .expectError(status.FORBIDDEN, 'Network cannot be created. Network with such name already exists')
                .send(done);
        });
    });

    describe('#Create Devices', function () {

        var DEVICE = utils.getName('network-device');
        var DEVICE_CLASS_VERSION = '1';
        var DEVICE_GUID = utils.getName('network-guid');

        var deviceClassId = null;

        var jwt1 = null;
        var jwt2 = null;
        var jwt3 = null;
        var jwt4 = null;

        before(function (done) {
            var params = [
                {
                    user: user,
                    actions: 'GetNetwork'
                },
                {
                    user: user,
                    actions: ['GetNetwork', 'GetDevice'],
                    deviceIds: utils.NON_EXISTING_ID
                },
                {
                    user: user,
                    actions: ['GetNetwork', 'GetDevice']
                },
                {
                    user: user,
                    actions: ['GetNetwork', 'GetDevice'],
                    networkIds: [networkId1]
                }
            ];

            function createJWTs(callback) {
                utils.jwt.createMany(params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    jwt1 = result[0];
                    jwt2 = result[1];
                    jwt3 = result[2];
                    jwt4 = result[3];
                    callback();
                });
            }

            function createDeviceClass(callback) {
                req.create(path.DEVICE_CLASS)
                    .params(utils.deviceClass.getParamsObj(DEVICE, utils.jwt.admin, DEVICE_CLASS_VERSION))
                    .send(function (err, result) {
                        if (err) {
                            return callback(err);
                        }
                        deviceClassId = result.id;
                        callback();
                    });
            }

            function createDevice(callback) {
                req.update(path.get(path.DEVICE, DEVICE_GUID))
                    .params(utils.device.getParamsObj(DEVICE, utils.jwt.admin,
                        {name: NETWORK_1, key: NETWORK_KEY}, {name: DEVICE, version: '1'}))
                    .send(function (err) {
                        if (err) {
                            return callback(err);
                        }
                        callback();
                    });
            }

            async.series([
                createJWTs,
                createDeviceClass,
                createDevice
            ], done);
        });

        it('should include the list of devices', function (done) {
            req.get(path.get(path.NETWORK, networkId1))
                .params({jwt: utils.jwt.admin})
                .expect({
                    name: NETWORK_1,
                    description: null,
                    devices: [{
                        id: DEVICE_GUID,
                        name: DEVICE,
                        status: null,
                        deviceClass: {
                            id: deviceClassId,
                            name: DEVICE
                        }
                    }]
                })
                .send(done);
        });

        it('should return empty devices list result when using jwt1', function (done) {
            req.get(path.get(path.NETWORK, networkId1))
                .params({jwt: jwt1})
                .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                .send(done);
        });

        it('should return empty devices list when using jwt2', function (done) {
            req.get(path.get(path.NETWORK, networkId1))
                .params({jwt: jwt2})
                .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                .send(done);
        });

        it('should return non-empty devices list when using jwt3', function (done) {
            req.get(path.get(path.NETWORK, networkId1))
                .params({jwt: jwt4})
                .expectTrue(function (result) {
                    return utils.core.isArrayOfLength(result.devices, 1);
                })
                .send(done);
        });
    });

    describe('#Update', function () {

        var networkId = null;

        before(function (done) {
            req.create(path.current)
                .params({
                    jwt: utils.jwt.admin,
                    data: { name: utils.getName('network-4'), key: NETWORK_KEY }
                })
                .send(function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    networkId = result.id;
                    done();
                });
        });

        it('should update with admin jwt', function (done) {
            var update = {
                name:utils.getName('network-4-update'),
                key: NETWORK_KEY,
                description: 'lorem ipsum dolor sit amet'
            };
            req.update(path.current)
                .params({jwt: utils.jwt.admin, id: networkId, data: update})
                .send(function (err) {
                    if (err) {
                        done(err);
                    }

                    req.get(path.current)
                        .params({jwt: utils.jwt.admin, id: networkId})
                        .expect(update)
                        .send(done);
                });
        });
    });

    describe('#Update Partial', function () {

        it('should update description with admin jwt', function (done) {
            req.update(path.current)
                .params({jwt: utils.jwt.admin, id: networkId1, data: {description: 'lorem ipsum dolor sit amet'}})
                .send(function (err) {
                    if (err) {
                        done(err);
                    }

                    req.get(path.current)
                        .params({jwt: utils.jwt.admin, id: networkId1})
                        .expect({
                            name: NETWORK_1,
                            key: NETWORK_KEY,
                            description: 'lorem ipsum dolor sit amet'
                        })
                        .send(done);
                });
        });
    });

    describe('#Delete', function () {

        var networkId = null;

        before(function (done) {
            req.create(path.current)
                .params({
                    jwt: utils.jwt.admin,
                    data: {name: utils.getName('network-5')}
                })
                .send(function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    networkId = result.id;
                    done();
                });
        });

        it('should fail get with 404 after we deleted network', function (done) {
            req.delete(path.current)
                .params({jwt: utils.jwt.admin, id: networkId})
                .send(function (err) {
                    if (err) {
                        return done(err);
                    }

                    req.get(path.current)
                        .params({jwt: utils.jwt.admin, id: networkId})
                        .expectError(status.NOT_FOUND,
                            format('Network with id = %s not found', networkId))
                        .send(done);
                });
        });
    });

    describe('#Bad Request', function () {
        it('should fail with 400 when use invalid request format', function (done) {
            req.create(path.current)
                .params({
                    jwt: utils.jwt.admin,
                    data: {users: 'invalid', invalidProp: utils.getName('network-invalid')}
                })
                .expectError(status.BAD_REQUEST)
                .send(done);
        });
    });

    describe('#Not Authorized', function () {
        describe('#No Authorization', function () {
            it('should fail with 401 if auth parameters omitted', function (done) {
                req.get(path.current)
                    .params({jwt: null})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 if auth parameters omitted', function (done) {
                req.get(path.current)
                    .params({jwt: utils.jwt.admin_refresh})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when selecting network by id, auth parameters omitted', function (done) {
                req.get(path.current)
                    .params({jwt: null, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when creating network with no auth parameters', function (done) {
                req.create(path.current)
                    .params({jwt: null, data: {name: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when updating network with no auth parameters', function (done) {
                req.update(path.current)
                    .params({jwt: null, id: utils.NON_EXISTING_ID, data: {name: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when deleting network with no auth parameters', function (done) {
                req.delete(path.current)
                    .params({jwt: null, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });
        });

        describe('#Dummy JWT Authorization', function () {

            var jwt = null;

            before(function (done) {
                utils.jwt.create(user.id, user.actions, void 0, void 0, function (err, result) {
                    if (err) {
                        return done(err);
                    }
                    jwt = result.accessToken;
                    done()
                })
            });

            it('should fail with 401 when getting list using invalid access key', function (done) {
                req.get(path.current)
                    .params({jwt: jwt})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when selecting network by id using invalid access key', function (done) {
                req.get(path.current)
                    .params({jwt: jwt, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when creating network using invalid access key', function (done) {
                req.create(path.current)
                    .params({jwt: jwt, data: {name: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when updating network using invalid access key', function (done) {
                req.update(path.current)
                    .params({jwt: jwt, id: utils.NON_EXISTING_ID, data: {name: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when deleting network with no auth parameters', function (done) {
                req.delete(path.current)
                    .params({jwt: jwt, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });
        });
    });

    describe('#Not Found', function () {

        it('should fail with 404 when selecting network by non-existing id', function (done) {
            req.get(path.current)
                .params({jwt: utils.jwt.admin, id: utils.NON_EXISTING_ID})
                .expectError(status.NOT_FOUND, format('Network with id = %s not found', utils.NON_EXISTING_ID))
                .send(done);
        });

        it('should fail with 404 when updating network by non-existing id', function (done) {
            req.update(path.current)
                .params({jwt: utils.jwt.admin, id: utils.NON_EXISTING_ID})
                .expectError(status.NOT_FOUND, format('Network with id = %s not found', utils.NON_EXISTING_ID))
                .send(done);
        });

        it('should succeed when deleting network by non-existing id', function (done) {
            req.delete(path.current)
                .params({jwt: utils.jwt.admin, id: utils.NON_EXISTING_ID})
                .send(done);
        });
    });

    after(function (done) {
        utils.clearDataJWT(done);
    });
});
