var assert = require('assert');
var utils = require('../common/utils.js');
var format = require('util').format;
var HttpSender = require('./http-sender');
var async = require('async');

var status = {
    OK: 200,
    EXPECTED_CREATED: 201,
    EXPECTED_UPDATED: 204,
    EXPECTED_DELETED: 204
};


//var url = 'http://nn7502.pg.devicehive.com/api';
//var deviceGuid = "11111111-2222-3333-4444-555555555555";

//var url = 'http://192.168.152.147:8080/dh/rest';
//var deviceGuid = "e50d6085-2aba-48e9-b1c3-73c673e414be";

var url = 'http://23.253.35.56:8081/DeviceHive/rest';
var accessKey = 'sStsRCchw3pCUeLwyVvhX/Q27CKeJgVFcNcDBvJiB6g=';
var deviceGuid = "11111111-2222-3333-4444-555555555555";
var deviceGuid2 = "22222222-3333-4444-5555-666666666666";

//var accessKey = utils.getConfig('server:accessKey');
var admin = {
    login: 'dhadmin',
    password: 'dhadmin_#911'
};
//var admin = {
//    login: 'admin',
//    password: 'Password1@'
//};
var owner = {
    login: '_ingegr-test-usr',
    password: 'Qwe12345!'
};
var ownerAccessKey = '';


var resources = [];

describe('REST Access Key', function(){

    //before(function () {
    //    path.setOwnerId(55);
    //    resources.push(path.get(path.USER, 55));
    //    resources.push(path.get(path.CURRENT_ACCESS_KEY, 48));
    //    resources.push(path.get(path.CURRENT_ACCESS_KEY, 47));
    //})

    before(function (done) {

        function addUser(callback) {

            var params = {
                user: admin,
                data: {
                    login: owner.login,
                    password: owner.password,
                    role: 1,
                    status: 0
                }
            };

            new HttpSender(url, path.USER)
                .post(params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    var userId = result.id;
                    resources.push(path.get(path.USER, userId));
                    path.setOwnerId(userId);
                    callback();
                });
        }

        function addAccessKey(callback) {

            var args = {
                user: owner,
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
    })

    describe('#GetAll()', function() {
        it('should return all access keys', function(done){

            var params = { user: admin };
            new HttpSender(url, path.ownerAccessKey)
                .get(params, function (err, result, xhr) {
                    if (err) {
                        return done(err);
                    }

                    assert.strictEqual(xhr.status, status.OK);
                    assert.strictEqual(Array.isArray(result), true);
                    assert.equal(result.length > 0, true);
                    assert.strictEqual(ownerAccessKey, result[0].key)

                    done();
                });
        })
    })

    describe('#Create()', function() {
        it('should match created and returned access key properties', function(done){

            var testData = [
                {
                    createParams: common.getParams('_integr-test-create-1', admin),
                    createPath: path.ownerAccessKey,
                    getParams: { user: admin },
                    getPath: path.ownerAccessKey
                },
                {
                    createParams: common.getParams('_integr-test-create-2', owner),
                    createPath: path.ownerAccessKey,
                    getParams: { user: owner },
                    getPath: path.CURRENT_ACCESS_KEY
                },
                {
                    createParams: common.getParams('_integr-test-create-3', owner),
                    createPath: path.ownerAccessKey,
                    getParams: { user: owner },
                    getPath: path.ownerAccessKey
                },
            ]

            function createTest(callback) {

                var td = testData.shift();

                var createParams = td.createParams;
                common.create(td.createPath, createParams, function (err, createResult) {
                    td.getParams.id = createResult.id;
                    common.get(td.getPath, td.getParams, function (err, getResult) {
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
    })

    describe('#Update()', function() {
        it('should match updated and returned access keys properties', function(done){

            var testData = [
                {
                    updateParams: common.getParams('_integr-test-update-1', admin, new Date(2020, 4, 1),
                        ['www.devicehive.com'], [3, 4], ['CreateDeviceNotification'], [deviceGuid], ['127.0.0.2']),
                    updatePath: path.ownerAccessKey,
                    getParams: { user: admin },
                    getPath: path.ownerAccessKey
                },
                {
                    updateParams: common.getParams('_integr-test-update-2', owner, new Date(2018, 3, 2),
                        ['www.integration-tests.com'], [5, 6], ['CreateDeviceCommand'], [deviceGuid2], ['127.0.0.2']),
                    updatePath: path.ownerAccessKey,
                    getParams: { user: owner },
                    getPath: path.CURRENT_ACCESS_KEY
                },
                {
                    updateParams: common.getParams('_integr-test-update-3', owner, new Date(2018, 4, 15),
                        ['www.devicehive.com'], [3, 4], ['CreateDeviceNotification', 'UpdateDeviceCommand'], [deviceGuid], ['127.0.0.2']),
                    updatePath: path.ownerAccessKey,
                    getParams: { user: owner },
                    getPath: path.ownerAccessKey
                },
            ];

            function createAccessKey(callback) {
                var createParams = common.getParams('_integr-test-update');
                common.create(path.ownerAccessKey, createParams, function (err, createResult) {
                    callback(err, createResult);
                });
            }

            function updateTest(createResult, callback) {

                var td = testData.shift();
                var updateParams = td.updateParams;

                updateParams.id = createResult.id;
                common.update(td.updatePath, updateParams, function (err) {

                    if (err) {
                        callback(err);
                    }

                    td.getParams.id = createResult.id;
                    common.get(td.getPath, td.getParams, function (err, getResult) {
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
    })

    describe('#Delete()', function() {
        it('should return 404 when try to get delted key', function (done) {

            var testData = [
                {
                    createParams: common.getParams('_integr-test-delete-1', admin),
                    createPath: path.ownerAccessKey,
                    params: { user: admin },
                    path: path.ownerAccessKey
                },
                {
                    createParams: common.getParams('_integr-test-delete-2', owner),
                    createPath: path.ownerAccessKey,
                    params: { user: owner },
                    path: path.CURRENT_ACCESS_KEY
                },
                {
                    createParams: common.getParams('_integr-test-delete-3', owner),
                    createPath: path.ownerAccessKey,
                    params: { user: owner },
                    path: path.ownerAccessKey
                },
            ]

            function deleteTest(callback) {

                var td = testData.shift();

                var createParams = td.createParams;
                common.create(td.createPath, createParams, function (err, createResult) {
                    td.params.id = createResult.id;
                    common.delete(td.path, td.params, function (err) {
                        common.get(td.path, td.params, function (err, getResult) {
                            assert.strictEqual(!(!err), true)
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
    })

    after(function (done) {
        resources.reverse();
        async.eachSeries(resources, function(resource, callback) {
            var params = { user: admin };
            new HttpSender(url, resource)
                .delete(params, function (err, result, xhr) {
                    if (err) {
                        return callback(err);
                    }

                    callback(null, result);
                });

        }, done);
    })
});

var path = {
    USER: '/user',
    ownerAccessKey: '/user/%d/accesskey',
    CURRENT_ACCESS_KEY: '/user/current/accesskey',

    setOwnerId: function (ownerId) {
        this.ownerAccessKey = format(this.ownerAccessKey, ownerId);
    },

    get: function (path, id) {
        return [path, id].join('/');
    }
}

var common = {

    getParams: function (label, user, expDate, domains, networkIds, actions, deviceGuids, subnets) {
        expDate || (expDate = new Date());
        expDate.setFullYear(expDate.getFullYear() + 10);
        return {
            user: user || admin,
            data: {
                label: label,
                expirationDate: expDate.toISOString(),
                permissions: [{
                    domains: domains || ['www.example.com'],
                    networkIds: networkIds || [1, 2],
                    actions: actions || ['GetNetwork', 'GetDevice'],
                    deviceGuids: deviceGuids || null,
                    subnets: subnets || ['127.0.0.1']
                }]
            }
        };
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

        new HttpSender(url, path.CURRENT_ACCESS_KEY)
            .post(params, function (err, result, xhr) {
                if (err) {
                    return cb(err);
                }

                resources.push(path.get(path.CURRENT_ACCESS_KEY, result.id))
                assert.strictEqual(xhr.status, status.EXPECTED_CREATED);

                cb(null, result);
            });
    },

    create: function ($path, params, cb) {
        new HttpSender(url, $path)
            .post(params, function (err, result, xhr) {
                if (err) {
                    return cb(err);
                }

                var resource = path.get($path, result.id);
                resources.push(resource)
                assert.strictEqual(xhr.status, status.EXPECTED_CREATED);

                cb(null, result, resource);
            });
    },

    get: function ($path, params, cb) {
        new HttpSender(url, path.get($path, params.id))
            .get(params, function (err, result, xhr) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(xhr.status, status.OK);

                cb(null, result);
            });
    },

    update: function ($path, params, cb) {
        new HttpSender(url, path.get($path, params.id))
            .put(params, function (err, result, xhr) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(xhr.status, status.EXPECTED_UPDATED);

                cb(null);
            });
    },

    delete: function ($path, params, cb) {
        new HttpSender(url, path.get($path, params.id))
            .delete(params, function (err, result, xhr) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(xhr.status, status.EXPECTED_DELETED);

                cb(null);
            });
    },

    expectAccessKey: function (actual, expected) {
        assert.strictEqual(+new Date(actual.expirationDate), +new Date(expected.expirationDate));
        assert.strictEqual(actual.label, expected.label);
        assert.deepEqual(actual.permissions, expected.permissions);
    }
}
