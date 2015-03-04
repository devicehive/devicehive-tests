var assert = require('assert');
var async = require('async');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;

describe.only('REST API Device Notification', function () {
    this.timeout(30000);

    var helper = utils.notification;

    var NETWORK = '_integr-test-network-device-notif';
    var DEVICE = '_integr-test-device-notif';
    var DEVICE_GUID = 'INTEGR-TEST-DEVICE-GUID-NOTIF-12345';
    var DEVICE_KEY = 'INTEGR-TEST-DEVICE-NOTIF-KEY';
    var NOTIFICATION = '_integr-test-notif-1';
    //var NOTIFICATION_2 = '_INTEGR-TEST-NOTIF-2';

    var networkId = null;
    //var deviceClassId = null;
    var user = null;
    var nonNetworkUser = null;
    var notificationId = null;

    function hasNotification(item) {
        return item.id === notificationId && item.notification === NOTIFICATION;
    }

    before(function (done) {

        path.current = path.NOTIFICATION.get(DEVICE_GUID);

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
                callback()
            });
        }

        function createDeviceClass(callback) {
            var params = utils.deviceClass.getParamsObj(DEVICE, utils.admin, '1');
            utils.create(path.DEVICE_CLASS, params, function (err) {
                callback(err);
            });
        }

        function createDevice(callback) {
            var params = utils.device.getParamsObj(DEVICE, utils.admin, DEVICE_KEY,
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

        before(function (done) {
            var params = helper.getParamsObj(NOTIFICATION, user);
            utils.create(path.NOTIFICATION.get(DEVICE_GUID), params, function (err, result) {
                if (err) {
                    return done(err);
                }

                notificationId = result.id;

                utils.create(path.NOTIFICATION.get(DEVICE_GUID), params, function (err) {
                    done(err);
                });
            });
        });

        it('should get all notifications for valid user', function (done) {
            utils.get(path.current, {user: user}, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 3), true, 'Is array of 3 objects');

                assert.strictEqual(result.some(function (item) {
                    return item.notification === '$device-add';
                }), true, 'Has $device-add notification');

                assert.strictEqual(result.some(hasNotification), true);

                done();
            })
        })

        it('should get notifications having same name when using name query', function (done) {
            var params = {user: user};
            params.query = path.query('notification', NOTIFICATION);
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 2), true, 'Is array of 2 objects');

                assert.strictEqual(result.every(function (item) {
                    return item.notification === NOTIFICATION;
                }), true);

                assert.strictEqual(result.some(function (item) {
                    return item.id === notificationId;
                }), true);

                done();
            })
        });

        it('should get notifications by start date', function (done) {
            var params = {user: user};
            var date = new Date();
            date.setHours(date.getHours() - 1);
            params.query = path.query('start', date.toISOString());
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 3), true, 'Is array of 3 objects');

                assert.strictEqual(result.some(hasNotification), true);

                done();
            })
        });

        it('should return empty notifications list when start date is out of range', function (done) {
            var params = {user: user};
            var date = new Date();
            date.setHours(date.getHours() + 1);
            params.query = path.query('start', date.toISOString());
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isEmptyArray(result), true, 'Is empty array');

                done();
            })
        });

        it('should return user notifications by end date', function (done) {
            var params = {user: user};
            var date = new Date();
            date.setHours(date.getHours() + 1);
            params.query = path.query('end', date.toISOString());
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 3), true, 'Is array of 3 objects');

                assert.strictEqual(result.some(hasNotification), true);

                done();
            });
        });

        it('should return empty notifications list when end date is out of range', function (done) {
            var params = {user: user};
            var date = new Date();
            date.setHours(date.getHours() - 1);
            params.query = path.query('end', date.toISOString());
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isEmptyArray(result), true, 'Is empty array');

                done();
            });
        });
    })

    describe('#Get', function () {

        var invalidAccessKey1 = null;
        var invalidAccessKey2 = null;
        var invalidAccessKey3 = null;
        var accessKey = null;

        before(function (done) {

            var params = [
                {
                    user: nonNetworkUser,
                    actions: 'GetDeviceNotification'
                },
                {
                    user: user,
                    actions: 'GetDeviceNotification',
                    networkIds: [0]
                },
                {
                    user: user,
                    actions: 'GetDeviceNotification',
                    deviceIds: utils.NON_EXISTING_ID
                },
                {
                    user: user,
                    actions: 'GetDeviceNotification'
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

                var params = helper.getParamsObj(NOTIFICATION, null);
                params.device = {
                    id: DEVICE_GUID,
                    key: DEVICE_KEY
                };

                utils.create(path.NOTIFICATION.get(DEVICE_GUID), params, function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    notificationId = result.id;
                    done(err);
                });
            })
        });

        it('should return error when using wrong user authentication', function (done) {
            var params = {user: nonNetworkUser};
            utils.get(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, format('DeviceHive server error - Device with such guid = %s not found',
                    DEVICE_GUID));
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);

                done();
            });
        });

        it('should return notifications when using allowed user authentication', function (done) {
            utils.get(path.current, {user: user}, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayNonEmpty(result), true, 'Is non-empty array');

                assert.strictEqual(result.some(hasNotification), true);

                done();
            });
        });

        it('should fail with 404 #1', function (done) {
            var params = {accessKey: invalidAccessKey1};
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
            utils.get(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayNonEmpty(result), true, 'Is array of 2 objects');
                assert.strictEqual(result.some(hasNotification), true);

                done();
            });
        });
    });

    after(function (done) {
        utils.clearResources(done);
    });
});