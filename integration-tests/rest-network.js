var async = require('async');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;
var req = require('./common/request');

describe('REST API Network', function () {
    this.timeout(30000);

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
                user: utils.admin,
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
                user: utils.admin,
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

        var accessKey1 = null;
        var accessKey2 = null;
        var accessKey3 = null;

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

            utils.accessKey.createMany(params, function (err, result) {
                if (err) {
                    return done(err);
                }

                accessKey1 = result[0];
                accessKey2 = result[1];
                accessKey3 = result[2];
                done();
            });
        });

        it('should get all networks', function (done) {
            req.get(path.current)
                .params({user: utils.admin})
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

        it('should get network by name', function (done) {
            req.get(path.current)
                .params({user: utils.admin})
                .query('name', NETWORK_1)
                .expect([{id: networkId1, name: NETWORK_1, key: NETWORK_KEY}])
                .send(done);
        });

        it('should get all networks for user', function (done) {
            req.get(path.current)
                .params({user: user})
                .expect([{id: networkId1, name: NETWORK_1, key: NETWORK_KEY}])
                .send(done);
        });

        it('should get all networks for accessKey', function (done) {
            req.get(path.current)
                .params({accessKey: accessKey1})
                .expect([{id: networkId1, name: NETWORK_1, key: NETWORK_KEY}])
                .send(done);
        });

        it('should get none of networks', function (done) {
            req.get(path.current)
                .params({accessKey: accessKey2})
                .expectTrue(function (result) {
                    return utils.core.isEmptyArray(result);
                })
                .send(done);
        });

        it('should get network for accessKey', function (done) {
            req.get(path.current)
                .params({accessKey: accessKey3})
                .expect([{id: networkId1, name: NETWORK_1, key: NETWORK_KEY}])
                .send(done);
        });
    });

    describe('#Get', function () {

        var accessKey1 = null;
        var accessKey2 = null;
        var accessKey3 = null;

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
                }
            ];

            utils.accessKey.createMany(params, function (err, result) {
                if (err) {
                    return done(err);
                }

                accessKey1 = result[0];
                accessKey2 = result[1];
                accessKey3 = result[2];
                done();
            });
        });

        it('should fail with 404 when getting with non-network user', function (done) {
            req.get(path.current)
                .params({user: nonNetworkUser, id: networkId1})
                .expectError(status.NOT_FOUND,
                    format('Network with id = %s not found', networkId1))
                .send(done);
        });

        it('should succeed when getting with allowed user', function (done) {
            req.get(path.current)
                .params({user: user, id: networkId1})
                .expect({id: networkId1, name: NETWORK_1, key: NETWORK_KEY})
                .send(done);
        });

        it('should fail with 404 #1', function (done) {
            req.get(path.current)
                .params({accessKey: accessKey1, id: networkId1})
                .expectError(status.NOT_FOUND, format('Network with id = %s not found', networkId1))
                .send(done);
        });

        it('should fail with 404 #2', function (done) {
            req.get(path.current)
                .params({accessKey: accessKey2, id: networkId1})
                .expectError(status.NOT_FOUND, format('Network with id = %s not found', networkId1))
                .send(done);
        });

        it('should succeed when getting network using valid access key', function (done) {
            req.get(path.current)
                .params({accessKey: accessKey3, id: networkId1})
                .expect({id: networkId1, name: NETWORK_1, key: NETWORK_KEY})
                .send(done);
        });
    });

    describe('#Create', function () {
        it('should create network using admin authentication', function (done) {
            var network = {name: utils.getName('network-3'), key: NETWORK_KEY};

            req.create(path.current)
                .params({user: utils.admin, data: network})
                .send(function (err, result) {
                    if (err) {
                        done(err);
                    }

                    req.get(path.current)
                        .params({user: utils.admin, id: result.id})
                        .expect(network)
                        .send(done);
                });
        });
    });

    describe('#Create Existing', function () {
        it('should fail with 403 when trying to create existing network', function (done) {
            req.create(path.current)
                .params({user: utils.admin, data: {name: NETWORK_1}})
                .expectError(status.FORBIDDEN, 'Network cannot be created. Network with such name already exists')
                .send(done);
        });
    });

    describe('#Create Devices', function () {

        var DEVICE = utils.getName('network-device');
        var DEVICE_CLASS_VERSION = '1';
        var DEVICE_GUID = utils.getName('network-guid');
        var DEVICE_KEY = utils.getName('network-key');

        var deviceClassId = null;

        var accessKey1 = null;
        var accessKey2 = null;
        var accessKey3 = null;

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
                }
            ];

            utils.accessKey.createMany(params, function (err, result) {
                if (err) {
                    return done(err);
                }

                accessKey1 = result[0];
                accessKey2 = result[1];
                accessKey3 = result[2];

                createDevice();
            });

            function createDevice() {
                req.create(path.DEVICE_CLASS)
                    .params(utils.deviceClass.getParamsObj(DEVICE, utils.admin, DEVICE_CLASS_VERSION))
                    .send(function (err, result) {
                        if (err) {
                            return done(err);
                        }

                        deviceClassId = result.id;

                        req.update(path.get(path.DEVICE, DEVICE_GUID))
                            .params(utils.device.getParamsObj(DEVICE, utils.admin,
                                {name: NETWORK_1, key: NETWORK_KEY}, {name: DEVICE, version: '1'}))
                            .send(done);
                    });
            }
        });

        it('should include the list of devices', function (done) {
            req.get(path.get(path.NETWORK, networkId1))
                .params({user: utils.admin})
                .expect({
                    name: NETWORK_1,
                    description: null,
                    devices: [{
                        id: DEVICE_GUID,
                        name: DEVICE,
                        status: null,
                        //network: { // TODO: Check this...
                        //    id: networkId1,
                        //    name: NETWORK_1
                        //},
                        deviceClass: {
                            id: deviceClassId,
                            name: DEVICE,
                            version: DEVICE_CLASS_VERSION
                        }
                    }]
                })
                .send(done);
        });

        it('should return empty devices list result when using accessKey1', function (done) {
            req.get(path.get(path.NETWORK, networkId1))
                .params({accessKey: accessKey1})
                .expectTrue(function (result) {
                    return utils.core.isEmptyArray(result.devices);
                })
                .send(done);
        });

        it('should return empty devices list when using accessKey2', function (done) {
            req.get(path.get(path.NETWORK, networkId1))
                .params({accessKey: accessKey2})
                .expectTrue(function (result) {
                    return utils.core.isEmptyArray(result.devices);
                })
                .send(done);
        });

        it('should return non-empty devices list when using accessKey3', function (done) {
            req.get(path.get(path.NETWORK, networkId1))
                .params({accessKey: accessKey3})
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
                    user: utils.admin,
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

        it('should update with admin authorization', function (done) {
            var update = {
                name:utils.getName('network-4-update'),
                key: NETWORK_KEY,
                description: 'lorem ipsum dolor sit amet'
            };
            req.update(path.current)
                .params({user: utils.admin, id: networkId, data: update})
                .send(function (err) {
                    if (err) {
                        done(err);
                    }

                    req.get(path.current)
                        .params({user: utils.admin, id: networkId})
                        .expect(update)
                        .send(done);
                });
        });
    });

    describe('#Update Partial', function () {
        it('should update description with admin authorization', function (done) {
            req.update(path.current)
                .params({user: utils.admin, id: networkId1, data: {description: 'lorem ipsum dolor sit amet'}})
                .send(function (err) {
                    if (err) {
                        done(err);
                    }

                    req.get(path.current)
                        .params({user: utils.admin, id: networkId1})
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
                    user: utils.admin,
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
                .params({user: utils.admin, id: networkId})
                .send(function (err) {
                    if (err) {
                        return done(err);
                    }

                    req.get(path.current)
                        .params({user: utils.admin, id: networkId})
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
                    user: utils.admin,
                    data: {invalidProp: utils.getName('network-invalid')}
                })
                .expectError(status.BAD_REQUEST)
                .send(done);
        });
    });

    describe('#Not Authorized', function () {
        describe('#No Authorization', function () {
            it('should fail with 401 if auth parameters omitted', function (done) {
                req.get(path.current)
                    .params({user: null})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when selecting network by id, auth parameters omitted', function (done) {
                req.get(path.current)
                    .params({user: null, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when creating network with no auth parameters', function (done) {
                req.create(path.current)
                    .params({user: null, data: {name: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when updating network with no auth parameters', function (done) {
                req.update(path.current)
                    .params({user: null, id: utils.NON_EXISTING_ID, data: {name: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when deleting network with no auth parameters', function (done) {
                req.delete(path.current)
                    .params({user: null, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });
        });

        describe('#User Authorization', function () {
            it('should fail with 401 when creating network with invalid user', function (done) {
                req.create(path.current)
                    .params({user: nonNetworkUser, data: {name: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when updating network with invalid user', function (done) {
                req.update(path.current)
                    .params({user: nonNetworkUser, id: utils.NON_EXISTING_ID, data: {name: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when deleting network with invalid user', function (done) {
                req.delete(path.current)
                    .params({user: nonNetworkUser, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });
        });

        describe('#Dummy Access Key Authorization', function () {

            var accessKey = null;

            before(function (done) {
                req.create(path.CURRENT_ACCESS_KEY)
                    .params(utils.accessKey.getParamsObj(utils.getName('dummy-access-key'), utils.admin, void 0, void 0, void 0, ['RegisterDevice']))
                    .send(function (err, result) {
                        if (err) {
                            return done(err);
                        }

                        accessKey = result.key;
                        done();
                    });
            });

            it('should fail with 401 when getting list using invalid access key', function (done) {
                req.get(path.current)
                    .params({accessKey: accessKey})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when selecting network by id using invalid access key', function (done) {
                req.get(path.current)
                    .params({accessKey: accessKey, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when creating network using invalid access key', function (done) {
                req.create(path.current)
                    .params({accessKey: accessKey, data: {name: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when updating network using invalid access key', function (done) {
                req.update(path.current)
                    .params({accessKey: accessKey, id: utils.NON_EXISTING_ID, data: {name: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when deleting network with no auth parameters', function (done) {
                req.delete(path.current)
                    .params({accessKey: accessKey, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });
        });
    });

    describe('#Not Found', function () {

        it('should fail with 404 when selecting network by non-existing id', function (done) {
            req.get(path.current)
                .params({user: utils.admin, id: utils.NON_EXISTING_ID})
                .expectError(status.NOT_FOUND, format('Network with id = %s not found', utils.NON_EXISTING_ID))
                .send(done);
        });

        it('should fail with 404 when updating network by non-existing id', function (done) {
            req.update(path.current)
                .params({user: utils.admin, id: utils.NON_EXISTING_ID})
                .expectError(status.NOT_FOUND, format('Network with id = %s not found', utils.NON_EXISTING_ID))
                .send(done);
        });

        it('should succeed when deleting network by non-existing id', function (done) {
            req.delete(path.current)
                .params({user: utils.admin, id: utils.NON_EXISTING_ID})
                .send(done);
        });
    });

    after(function (done) {
        utils.clearData(done);
    });
});
