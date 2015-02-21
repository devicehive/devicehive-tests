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
var path = '/user/%d/accesskey';

describe('REST Access Key', function(){

    //before(function () {
    //    path = format(path, 15);
    //    resources.push('/user/' + 40);
    //    resources.push('/user/current/accesskey/' + 48);
    //    resources.push('/user/current/accesskey/' + 47);
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

            new HttpSender(url, '/user')
                .post(params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    var userId = result.id;
                    resources.push('/user/' + userId);
                    path = format(path, userId);
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
            new HttpSender(url, path)
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

            function createForAdmin(callback) {
                var createParams = common.getParams('_integr-test-create-1');
                common.create(path, createParams, function (err, createResult) {
                    var getParams = { user: admin, id: createResult.id };
                    common.get(path, getParams, function (err, getResult) {
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

            function createForOwnerCurrent(callback) {
                var createParams = common.getParams('_integr-test-create-2');
                common.create(path, createParams, function (err, createResult) {
                    var getParams = { user: owner, id: createResult.id };
                    common.get('/user/current/accesskey', getParams, function (err, getResult) {
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

            function createForOwner(callback) {
                var createParams = common.getParams('_integr-test-create-3');
                common.create(path, createParams, function (err, createResult) {
                    var getParams = { user: owner, id: createResult.id };
                    common.get(path, getParams, function (err, getResult) {
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
                createForAdmin,
                createForOwnerCurrent,
                createForOwner
            ], done);
        })
    })

    describe('#Update()', function() {
        it('should match updated and returned access keys properties', function(done){

            function createAccessKey(callback) {
                var createParams = common.getParams('_integr-test-update');
                common.create(path, createParams, callback);
            }

            function updateForAdmin(createResult, resource, callback) {
                var updateParams = common.getParams('_integr-test-update-1', new Date(2020, 4, 1),
                    ['www.devicehive.com'], [3, 4], ['CreateDeviceNotification'], [deviceGuid], ['127.0.0.2'])
                updateParams.id = createResult.id;
                common.update(path, updateParams, function (err) {

                    if (err) {
                        callback(err);
                    }

                    var getParams = { user: admin, id: createResult.id };
                    common.get(path, getParams, function (err, getResult) {
                        if (err) {
                            callback(err);
                        }

                        assert.strictEqual(createResult.id, getResult.id);
                        assert.strictEqual(createResult.key, getResult.key);
                        common.expectAccessKey(getResult, updateParams.data);

                        callback();
                    })
                });
            }

            async.waterfall([
                    createAccessKey,
                    updateForAdmin
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

var common = {

    getParams: function (label, expDate, domains, networkIds, actions, deviceGuids, subnets) {
        expDate || (expDate = new Date());
        expDate.setFullYear(expDate.getFullYear() + 10);
        return {
            user: admin,
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

        new HttpSender(url, '/user/current/accesskey')
            .post(params, function (err, result, xhr) {
                if (err) {
                    return cb(err);
                }

                resources.push('/user/current/accesskey/' + result.id)
                assert.strictEqual(xhr.status, status.EXPECTED_CREATED);

                cb(null, result);
            });
    },

    create: function (path, params, cb) {
        new HttpSender(url, path)
            .post(params, function (err, result, xhr) {
                if (err) {
                    return cb(err);
                }

                var resource = path + '/' + result.id;
                resources.push(resource)
                assert.strictEqual(xhr.status, status.EXPECTED_CREATED);

                cb(null, result, resource);
            });
    },

    get: function (path, params, cb) {
        new HttpSender(url, path + '/' + params.id)
            .get(params, function (err, result, xhr) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(xhr.status, status.OK);

                cb(null, result);
            });
    },

    update: function (path, params, cb) {
        new HttpSender(url, path + '/' + params.id)
            .put(params, function (err, result, xhr) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(xhr.status, status.EXPECTED_UPDATED);

                cb(null);
            });
    },

    expectAccessKey: function (actual, expected) {
        assert.strictEqual(+new Date(actual.expirationDate), +new Date(expected.expirationDate));
        assert.strictEqual(actual.label, expected.label);
        assert.deepEqual(actual.permissions, expected.permissions);
    }
}
