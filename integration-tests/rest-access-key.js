var assert = require('assert');
var async = require('async');
var format = require('util').format;
var Http = require('./common/http').Http;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;

//var deviceGuid = "11111111-2222-3333-4444-555555555555";

//var deviceGuid = "e50d6085-2aba-48e9-b1c3-73c673e414be";

var accessKey = 'sStsRCchw3pCUeLwyVvhX/Q27CKeJgVFcNcDBvJiB6g=';
var deviceGuid = "11111111-2222-3333-4444-555555555555";
var deviceGuid2 = "22222222-3333-4444-5555-666666666666";

//var accessKey = utils.getConfig('server:accessKey');
var ownerAccessKey = '';

var common = {

    getParams: function (label, user, expDate, domains, networkIds, actions, deviceGuids, subnets) {

        expDate || (expDate = new Date());
        expDate.setFullYear(expDate.getFullYear() + 10);

        return this.getParamsObj(label, user, expDate,
            domains || ['www.example.com'],
            networkIds || [1, 2],
            actions || ['GetNetwork', 'GetDevice'],
            deviceGuids || [deviceGuid],
            subnets || ['127.0.0.1']);
    },

    getParamsObj: function (label, user, expDate, domains, networkIds, actions, deviceGuids, subnets) {

        var permission = {};

        if (domains) {
            permission.domains = domains;
        }

        if (networkIds) {
            permission.networkIds = networkIds;
        }

        if (actions) {
            permission.actions = actions;
        }

        if (deviceGuids) {
            permission.deviceGuids = deviceGuids;
        }

        if (subnets) {
            permission.subnets = subnets;
        }

        var params = {
            data: {
                label: label,
                permissions: [permission]
            }
        };

        if (user) {
            params.user = user;
        }

        if (expDate) {
            params.data.expirationDate = expDate.toISOString();
        }

        return params;
    },

    createAccessKey: function (args, cb) {
        var params = {
            user: args.user,
            data: {
                label: '_integr-tests-key',
                permissions: [{
                    actions: args.actions,
                    networkIds: args.networkIds,
                    deviceGuids: args.deviceGuids
                }]
            }
        };

        new Http(utils.url, path.CURRENT_ACCESS_KEY)
            .post(params, function (err, result, xhr) {
                if (err) {
                    return cb(err);
                }

                utils.resources.push(path.get(path.CURRENT_ACCESS_KEY, result.id));
                assert.strictEqual(xhr.status, status.EXPECTED_CREATED);

                cb(null, result);
            });
    },

    expectAccessKey: function (actual, expected) {
        assert.strictEqual(+new Date(actual.expirationDate), +new Date(expected.expirationDate));
        assert.strictEqual(actual.label, expected.label);
        assert.deepEqual(actual.permissions, expected.permissions);
    }
};

describe('REST Access Key', function () {

    //before(function () {
    //    var ownerId = 102;
    //    path.setOwnerId(ownerId);
    //    utils.resources.push(path.get(path.USER, ownerId));
    //    utils.resources.push(path.get(path.USER, 103));
    //    utils.resources.push(path.get(path.USER, 105));
    //
    //    var accessKeyIds = [264, 265, 267];
    //    accessKeyIds.forEach(function (id) {
    //        utils.resources.push(path.get(path.CURRENT_ACCESS_KEY, id));
    //    })
    //})

    before(function (done) {

        function addUser(callback) {
            utils.createUser(utils.owner.login, utils.owner.password, 1, 0,
                function (err, result) {
                    path.setOwnerId(result.id);
                    callback();
                });
        }

        function addAccessKey(callback) {

            var args = {
                user: utils.owner,
                actions: [
                    'GetNetwork',
                    'GetDevice',
                    'GetDeviceState',
                    'GetDeviceNotification',
                    'GetDeviceCommand',
                    'RegisterDevice',
                    'CreateDeviceNotification',
                    'CreateDeviceCommand',
                    'UpdateDeviceCommand'
                ]
            };
            common.createAccessKey(args, function (err, data) {
                ownerAccessKey = data.key;
                callback(err);
            });
        }

        async.series([addUser, addAccessKey], done);
    });

    describe('#GetAll()', function() {
        it('should return all access keys', function(done){

            var params = { user: utils.admin };
            new Http(utils.url, path.ownerAccessKey)
                .get(params, function (err, result, xhr) {
                    if (err) {
                        return done(err);
                    }

                    assert.strictEqual(xhr.status, status.EXPECTED_READ);
                    assert.strictEqual(Array.isArray(result), true);
                    assert.equal(result.length > 0, true);
                    assert.strictEqual(ownerAccessKey, result[0].key);

                    done();
                });
        })
    });

    describe('#Create()', function() {
        it('should match created and returned access key properties', function(done){

            var testData = [
                {
                    createParams: common.getParams('_integr-test-create-1', utils.admin),
                    createPath: path.ownerAccessKey,
                    getParams: { user: utils.admin },
                    getPath: path.ownerAccessKey
                },
                {
                    createParams: common.getParams('_integr-test-create-2', utils.owner),
                    createPath: path.ownerAccessKey,
                    getParams: { user: utils.owner },
                    getPath: path.CURRENT_ACCESS_KEY
                },
                {
                    createParams: common.getParams('_integr-test-create-3', utils.owner),
                    createPath: path.ownerAccessKey,
                    getParams: { user: utils.owner },
                    getPath: path.ownerAccessKey
                }
            ];

            function createTest(callback) {

                var td = testData.shift();

                var createParams = td.createParams;
                utils.create(td.createPath, createParams, function (err, createResult) {
                    td.getParams.id = createResult.id;
                    utils.get(td.getPath, td.getParams, function (err, getResult) {
                        if (err) {
                            callback(err);
                        }

                        assert.strictEqual(createResult.id, getResult.id);
                        assert.strictEqual(createResult.key, getResult.key);
                        common.expectAccessKey(getResult, createParams.data);

                        callback();
                    })
                })
            }

            async.series([
                createTest,
                createTest,
                createTest
            ], done);
        })
    });

    describe('#Update()', function() {
        it('should match updated and returned access keys properties', function(done){

            var testData = [
                {
                    updateParams: common.getParams('_integr-test-update-1', utils.admin, new Date(2020, 4, 1),
                        ['www.devicehive.com'], [3, 4], ['CreateDeviceNotification'], [deviceGuid], ['127.0.0.2']),
                    updatePath: path.ownerAccessKey,
                    getParams: { user: utils.admin },
                    getPath: path.ownerAccessKey
                },
                {
                    updateParams: common.getParams('_integr-test-update-2', utils.owner, new Date(2018, 3, 2),
                        ['www.integration-tests.com'], [5, 6], ['CreateDeviceCommand'], [deviceGuid2], ['127.0.0.2']),
                    updatePath: path.ownerAccessKey,
                    getParams: { user: utils.owner },
                    getPath: path.CURRENT_ACCESS_KEY
                },
                {
                    updateParams: common.getParams('_integr-test-update-3', utils.owner, new Date(2018, 4, 15),
                        ['www.devicehive.com'], [3, 4], ['CreateDeviceNotification', 'UpdateDeviceCommand'], [deviceGuid], ['127.0.0.2']),
                    updatePath: path.ownerAccessKey,
                    getParams: { user: utils.owner },
                    getPath: path.ownerAccessKey
                }
            ];

            function createAccessKey(callback) {
                var createParams = common.getParams('_integr-test-update', utils.admin);
                utils.create(path.ownerAccessKey, createParams, function (err, createResult) {
                    callback(err, createResult);
                });
            }

            function updateTest(createResult, callback) {

                var td = testData.shift();
                var updateParams = td.updateParams;

                updateParams.id = createResult.id;
                utils.update(td.updatePath, updateParams, function (err) {

                    if (err) {
                        callback(err);
                    }

                    td.getParams.id = createResult.id;
                    utils.get(td.getPath, td.getParams, function (err, getResult) {
                        if (err) {
                            callback(err);
                        }

                        assert.strictEqual(createResult.id, getResult.id);
                        assert.strictEqual(createResult.key, getResult.key);
                        common.expectAccessKey(getResult, updateParams.data);

                        callback(null, createResult);
                    })
                });
            }


            async.waterfall([
                createAccessKey,
                updateTest,
                updateTest,
                updateTest
            ], done);
        })
    });

    describe('#Delete()', function() {
        it('should return 404 when try to get delted key', function (done) {

            var testData = [
                {
                    createParams: common.getParams('_integr-test-delete-1', utils.admin),
                    createPath: path.ownerAccessKey,
                    params: { user: utils.admin },
                    path: path.ownerAccessKey
                },
                {
                    createParams: common.getParams('_integr-test-delete-2', utils.owner),
                    createPath: path.ownerAccessKey,
                    params: { user: utils.owner },
                    path: path.CURRENT_ACCESS_KEY
                },
                {
                    createParams: common.getParams('_integr-test-delete-3', utils.owner),
                    createPath: path.ownerAccessKey,
                    params: { user: utils.owner },
                    path: path.ownerAccessKey
                }
            ];

            function deleteTest(callback) {

                var td = testData.shift();

                var createParams = td.createParams;
                utils.create(td.createPath, createParams, function (err, createResult) {
                    td.params.id = createResult.id;
                    utils.delete(td.path, td.params, function () {
                        utils.get(td.path, td.params, function (err) {
                            assert.strictEqual(!(!err), true, 'Error object created')
                            assert.strictEqual(err.error, 'DeviceHive server error - Access key not found.');
                            callback();
                        })
                    })
                })
            }

            async.series([
                deleteTest,
                deleteTest,
                deleteTest
            ], done);
        })
    });

    describe('#Authorization()', function() {
        it('should return network', function (done) {

            var NETWORK_NAME = '_integr-test-network';

            function onResultOk(err, result, networkId) {
                assert.strictEqual(!(!err), false, 'No error object');
                assert.deepEqual(result.id, networkId);
                assert.deepEqual(result.name, NETWORK_NAME);
            }

            function onResultErr1(err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'DeviceHive server error - Unauthorized');
            }

            function onResultErr2(err, result, networkId) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, format('DeviceHive server error - Network with id = %d not found', networkId));
            }

            var testData = [
                {
                    // Check the key authorization works
                    get: function (user) {
                        return common.getParamsObj(
                            '_integr-test-auth-1', user, void 0, void 0, void 0, ['GetNetwork']);
                    },
                    onResult: onResultOk
                },
                {
                    // Check the key authorization with explicit network works
                    get: function (user, networkId) {
                        return common.getParamsObj(
                            '_integr-test-auth-2', user, void 0, void 0, [networkId], ['GetNetwork']);
                    },
                    onResult: onResultOk
                },
                {
                    // Check the key authorization with explicit subnet works
                    get: function (user) {
                        return common.getParamsObj(
                            '_integr-test-auth-3', user, void 0, void 0, void 0, ['GetNetwork'], void 0, ['0.0.0.0/0']);
                    },
                    onResult: onResultOk
                },
                {
                    // Check the expiration date is validated
                    get: function (user, networkId) {
                        var expDate = new Date();
                        expDate.setHours(expDate.getHours() - 1);
                        return common.getParamsObj(
                            '_integr-test-auth-4', user, expDate, void 0, [networkId], ['GetNetwork']);
                    },
                    onResult: onResultErr1
                },
                {
                    // Check the source subnet is validated
                    get: function (user) {
                        return common.getParamsObj(
                            '_integr-test-auth-5', user, void 0, void 0, void 0, ['GetNetwork'], void 0, ['10.10.10.0/24']);
                    },
                    onResult: onResultErr1
                },
                {
                    // Check the action is validated
                    get: function (user) {
                        return common.getParamsObj(
                            '_integr-test-auth-6', user, void 0, void 0, void 0, ['UpdateDeviceCommand']);
                    },
                    onResult: onResultErr1
                },
                {
                    // Check the network is validated
                    get: function (user, networkId) {
                        return common.getParamsObj(
                            '_integr-test-auth-7', user, void 0, void 0, [networkId + 1], ['GetNetwork']);
                    },
                    onResult: onResultErr2
                },
                {
                    // Check the network is validated on admin key
                    get: function (user, networkId) {
                        return common.getParamsObj(
                            '_integr-test-auth-8', utils.admin, void 0, void 0, [networkId + 1], ['GetNetwork']);
                    },
                    onResult: onResultErr2
                },
            ];

            function createNetwork(callback) {

                var params = {
                    user: utils.admin,
                    data: {
                        name: NETWORK_NAME
                    }
                };

                utils.create(path.NETWORK, params, function (err, result) {
                    callback(err, result.id)
                });
            }

            function createUser(networkId, callback) {
                utils.createUser2(1, [networkId], function (err, result) {
                    callback(err, result.user, networkId);
                });
            }

            function authTest(user, networkId, callback) {
                var td = testData.shift();
                var params = td.get(user, networkId);
                utils.create(path.CURRENT_ACCESS_KEY, params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    var params = {accessKey: result.key};
                    utils.get(path.get(path.NETWORK, networkId), params, function (err, result) {
                        td.onResult(err, result, networkId);
                        callback(null, user, networkId);
                    });
                });
            }

            async.waterfall([
                createNetwork,
                createUser,
                authTest,
                authTest,
                authTest,
                authTest,
                authTest,
                authTest,
                authTest,
                authTest,
            ], done);
        })
    });

    after(function (done) {
        utils.clearResources(done);
    })
});
