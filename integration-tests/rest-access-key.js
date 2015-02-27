var assert = require('assert');
var async = require('async');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;
var consts = require('./common/consts');

describe.only('REST API Access Key', function () {

    var ac = utils.accessKey;

    before(function (done) {
        utils.createUser(utils.user.login, utils.user.password, 1, 0,
            function (err, result) {
                if (err) {
                    return done(err);
                }

                path.current = format('/user/%d/accesskey', result.id);
                done();
            });
    });

    describe('#GetAll', function() {

        var adminAccessKey = null;
        var userAccessKey = null;

        before(function (done) {

            function createAdminKey(callback) {
                var params = {
                    user: utils.admin,
                    data: {
                        label: '_integr-test-admin-key',
                        permissions: [{
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
                        }]
                    }
                };

                utils.create(path.CURRENT_ACCESS_KEY, params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    adminAccessKey = result.key;
                    callback();
                })
            }

            function createUserKey(callback) {
                var params = {
                    user: utils.user,
                    data: {
                        label: '_integr-test-user-key',
                        permissions: [{
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
                        }]
                    }
                };

                utils.create(path.current, params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    userAccessKey = result.key;
                    callback();
                })
            }

            async.series([
                createAdminKey,
                createUserKey,
            ], done);
        })

        it('should get administrator keys', function(done){

            var params = { user: utils.admin };
            utils.get(path.CURRENT_ACCESS_KEY, params, function (err, result) {
                if (err) {
                    return done(err);
                }

                function hasAdminAccessKey(item) {
                    return item.key === adminAccessKey;
                }

                assert.strictEqual(Array.isArray(result), true);
                assert.equal(result.length > 0, true);
                assert.strictEqual(result.some(hasAdminAccessKey), true);

                done();
            });
        })

        it('should get user keys', function(done){

            var params = { user: utils.user };
            utils.get(path.current, params, function (err, result) {
                if (err) {
                    return done(err);
                }

                function hasOwnerAccessKey(item) {
                    return item.key === userAccessKey;
                }

                assert.strictEqual(Array.isArray(result), true);
                assert.equal(result.length > 0, true);
                assert.strictEqual(result.some(hasOwnerAccessKey), true);

                done();
            });
        })
    });

    describe('#Create', function() {

        function createTest(testData, callback) {
            utils.create(testData.createPath, testData.createParams, function (err, createResult) {
                if (err) {
                    return callback(err);
                }

                testData.getParams.id = createResult.id;
                utils.get(testData.getPath, testData.getParams, function (err, getResult) {
                    if (err) {
                        return callback(err);
                    }

                    assert.strictEqual(createResult.id, getResult.id);
                    assert.strictEqual(createResult.key, getResult.key);
                    ac.expectAccessKey(getResult, testData.createParams.data);

                    callback();
                })
            })
        }

        it('should allow administrator to create key', function (done) {
            createTest({
                createParams: ac.getParams('_integr-test-create-1', utils.admin),
                createPath: path.current,
                getParams: {user: utils.admin},
                getPath: path.current
            }, done);
        })

        it('should allow user to create key', function (done) {
            createTest({
                createParams: ac.getParams('_integr-test-create-2', utils.user),
                createPath: path.current,
                getParams: { user: utils.user },
                getPath: path.CURRENT_ACCESS_KEY
            }, done);
        })

        it('should allow user to create key using same path', function (done) {
            createTest({
                createParams: ac.getParams('_integr-test-create-3', utils.user),
                createPath: path.current,
                getParams: { user: utils.user },
                getPath: path.current
            }, done);
        })
    });

    describe('#Update', function() {

        var accessKeyObj = null;

        before(function (done) {
            var createParams = ac.getParams('_integr-test-update', utils.admin);
            utils.create(path.current, createParams, function (err, result) {
                if (err) {
                    return done(err);
                }

                accessKeyObj = result;
                done();
            });
        })

        function updateTest(testData, callback) {
            testData.updateParams.id = accessKeyObj.id;
            utils.update(testData.updatePath, testData.updateParams, function (err) {

                if (err) {
                    return callback(err);
                }

                testData.getParams.id = accessKeyObj.id;
                utils.get(testData.getPath, testData.getParams, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    assert.strictEqual(accessKeyObj.id, result.id);
                    assert.strictEqual(accessKeyObj.key, result.key);
                    ac.expectAccessKey(result, testData.updateParams.data);

                    callback();
                })
            });
        }

        it('should allow administrator to update key', function (done) {
            updateTest({
                updateParams: ac.getParams('_integr-test-update-1', utils.admin, new Date(2020, 4, 1),
                    ['www.devicehive.com'], [3, 4], ['CreateDeviceNotification'], void 0, ['127.0.0.2']),
                updatePath: path.current,
                getParams: { user: utils.admin },
                getPath: path.current
            }, done);
        })

        it('should allow user to update key', function (done) {
            updateTest({
                updateParams: ac.getParams('_integr-test-update-2', utils.user, new Date(2018, 3, 2),
                    ['www.integration-tests.com'], [5, 6], ['CreateDeviceCommand'], ['22222222-3333-4444-5555-666666666666'], ['127.0.0.2']),
                updatePath: path.current,
                getParams: { user: utils.user },
                getPath: path.CURRENT_ACCESS_KEY
            }, done);
        })

        it('should allow user to update key using same path', function (done) {
            updateTest({
                updateParams: ac.getParams('_integr-test-update-3', utils.user, new Date(2018, 4, 15),
                    ['www.devicehive.com'], [3, 4], ['CreateDeviceNotification', 'UpdateDeviceCommand'], void 0, ['127.0.0.2']),
                updatePath: path.current,
                getParams: { user: utils.user },
                getPath: path.current
            }, done);
        })
    });

    describe('#Delete', function() {

        function deleteTest(testData, callback) {
            utils.create(testData.createPath, testData.createParams, function (err, createResult) {
                if (err) {
                    return callback(err);
                }

                testData.params.id = createResult.id;
                utils.delete(testData.path, testData.params, function (err) {
                    if (err) {
                        return callback(err);
                    }

                    utils.get(testData.path, testData.params, function (err) {
                        assert.strictEqual(!(!err), true, 'Error object created')
                        assert.strictEqual(err.error, 'DeviceHive server error - Access key not found.');
                        callback();
                    })
                })
            })
        }

        it('should allow administrator to delete key', function (done) {
            deleteTest({
                createParams: ac.getParams('_integr-test-delete-1', utils.admin),
                createPath: path.current,
                params: { user: utils.admin },
                path: path.current
            }, done);
        })

        it('should allow user to delete key', function (done) {
            deleteTest({
                createParams: ac.getParams('_integr-test-delete-2', utils.user),
                createPath: path.current,
                params: { user: utils.user },
                path: path.CURRENT_ACCESS_KEY
            }, done);
        })

        it('should allow user to delete key using user path', function (done) {
            deleteTest({
                createParams: ac.getParams('_integr-test-delete-3', utils.user),
                createPath: path.current,
                params: { user: utils.user },
                path: path.current
            }, done);
        })
    });

    describe('#Authorization', function() {

        var NETWORK_NAME = '_integr-test-network';
        var user = null;
        var networkId = null;

        before(function (done) {

            function createNetwork(callback) {

                var params = {
                    user: utils.admin,
                    data: {
                        name: NETWORK_NAME
                    }
                };

                utils.create(path.NETWORK, params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    callback(null, result.id)
                });
            }

            function createUser($networkId, callback) {
                utils.createUser2(1, [$networkId], function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    user = result.user;
                    networkId = $networkId;
                    callback();
                });
            }

            async.waterfall([
                createNetwork,
                createUser
            ], done);
        })

        function assertResultOk(err, result, networkId) {
            assert.strictEqual(!(!err), false, 'No error object');
            assert.deepEqual(result.id, networkId);
            assert.deepEqual(result.name, NETWORK_NAME);
        }

        function assertResultErr1(err) {
            assert.strictEqual(!(!err), true, 'Error object created');
            assert.strictEqual(err.error, 'DeviceHive server error - Unauthorized');
        }

        function assertResultErr2(err, result, networkId) {
            assert.strictEqual(!(!err), true, 'Error object created');
            assert.strictEqual(err.error, format('DeviceHive server error - Network with id = %d not found', networkId));
        }

        function authTest(testData, callback) {
            utils.create(path.CURRENT_ACCESS_KEY, testData.params, function (err, result) {
                if (err) {
                    return callback(err);
                }

                var params = {accessKey: result.key};
                utils.get(path.get(path.NETWORK, networkId), params, function (err, result) {
                    testData.onResult(err, result, networkId);
                    callback();
                });
            });
        }

        it('checks the key authorization works', function (done) {
            authTest({
                params: ac.getParamsObj(
                    '_integr-test-auth-1', user, void 0, void 0, void 0, ['GetNetwork']),
                onResult: assertResultOk
            }, done);
        })

        it('checks the key authorization with explicit network works', function (done) {
            authTest({
                params: ac.getParamsObj(
                    '_integr-test-auth-2', user, void 0, void 0, [networkId], ['GetNetwork']),
                onResult: assertResultOk
            }, done);
        })

        it('checks the key authorization with explicit subnet works', function (done) {
            authTest({
                params: ac.getParamsObj(
                    '_integr-test-auth-3', user, void 0, void 0, void 0, ['GetNetwork'], void 0, ['0.0.0.0/0']),
                onResult: assertResultOk
            }, done);
        })

        it('checks the expiration date is validated', function (done) {
            var expDate = new Date();
            expDate.setHours(expDate.getHours() - 1);
            authTest({
                params: ac.getParamsObj(
                    '_integr-test-auth-4', user, expDate, void 0, [networkId], ['GetNetwork']),
                onResult: assertResultErr1
            }, done);
        })

        it('checks the source subnet is validated', function (done) {
            authTest({
                params: ac.getParamsObj(
                    '_integr-test-auth-5', user, void 0, void 0, void 0, ['GetNetwork'], void 0, ['10.10.10.0/24']),
                onResult: assertResultErr1
            }, done);
        })

        it('checks the action is validated', function (done) {
            authTest({
                params: ac.getParamsObj(
                    '_integr-test-auth-6', user, void 0, void 0, void 0, ['UpdateDeviceCommand']),
                onResult: assertResultErr1
            }, done);
        })

        it('checks the network is validated', function (done) {
            authTest({
                params: ac.getParamsObj(
                    '_integr-test-auth-7', user, void 0, void 0, [networkId + 1], ['GetNetwork']),
                onResult: assertResultErr2
            }, done);
        })

        it('checks the network is validated on admin key', function (done) {
            authTest({
                params: ac.getParamsObj(
                    '_integr-test-auth-8', utils.admin, void 0, void 0, [networkId + 1], ['GetNetwork']),
                onResult: assertResultErr2
            }, done);
        })
    });

    describe('#BadRequest', function () {
        it('should return error 400 when trying to create access key without actions', function (done) {

            var params = ac.getParamsObj('_integr-test-bad-request', utils.admin);
            utils.create(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'DeviceHive server error - Actions are required!');
                assert.strictEqual(err.httpStatus, status.BAD_REQUEST);
                done();
            })

        })
    })

    describe('#Not authorized', function () {

        describe('no authorization', function () {
            it('should return error when accessing key without authorization', function (done) {
                var params = {user: null};
                utils.get(path.current, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'DeviceHive server error - Not authorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            })

            it('should return error when accessing non-existing key without authorization', function (done) {
                var params = {user: null, id: consts.NON_EXISTING_ID };
                utils.get(path.current, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'DeviceHive server error - Not authorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            })

            it('should return error when creating key without authorization', function (done) {
                var params = ac.getParamsObj('_integr-test-create-no-auth', null);
                utils.create(path.current, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'DeviceHive server error - Not authorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            })

            it('should return error when updating non-existing key without authorization', function (done) {
                var params = ac.getParams('_integr-test-update-non-existing', null);
                params.id = consts.NON_EXISTING_ID;
                utils.update(path.current, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'DeviceHive server error - Not authorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            })

            it('should return error when deleting non-existing key without authorization', function (done) {
                var params = {user: null, id: consts.NON_EXISTING_ID};
                utils.delete(path.current, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'DeviceHive server error - Not authorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            })
        })

        describe('another user authorization', function () {
            var user = null;

            before(function (done) {
                utils.createUser2(1, [], function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    user = result.user;
                    done();
                })
            })

            it('should return error when accessing key with another user', function (done) {
                var params = {user: user};
                utils.get(path.current, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'DeviceHive server error - Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            })

            it('should return error when accessing non-existing key', function (done) {
                var params = {user: user, id: consts.NON_EXISTING_ID};
                utils.get(path.current, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'DeviceHive server error - Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            })

            it('should return error when creating key using wrong user credentials', function (done) {
                var params = ac.getParamsObj('_integr-test-create-other-user', user);
                utils.create(path.current, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'DeviceHive server error - Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            })

            it('should return error when updating non-existing key', function (done) {
                var params = ac.getParams('_integr-test-update-non-existing', user);
                params.id = consts.NON_EXISTING_ID;
                utils.update(path.current, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'DeviceHive server error - Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            })

            it('should return error when deleting non-existing key', function (done) {
                var params = {user: user, id: consts.NON_EXISTING_ID};
                utils.delete(path.current, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'DeviceHive server error - Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            })
        })
    })

    describe('#Not Found', function () {

        it('should return error when accessing non-existing key', function (done) {
            var params = {user: utils.admin, id: consts.NON_EXISTING_ID };
            utils.get(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'DeviceHive server error - Access key not found.');
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);
                done();
            })
        })

        it('should return error when updating non-existing key', function (done) {
            var params = ac.getParams('_integr-test-update-non-existing', utils.admin);
            params.id = consts.NON_EXISTING_ID;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'DeviceHive server error - Access key not found');
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);
                done();
            })
        })

        it('should not return error when deleting non-existing key', function (done) {
            var params = {user: utils.admin, id: consts.NON_EXISTING_ID};
            utils.delete(path.current, params, function (err) {
                assert.strictEqual(!(!err), false, 'No error');
                done();
            })
        })

    })

    after(function (done) {
        utils.clearResources(done);
    })
});
