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
    var NOTIFICATION_2 = '_INTEGR-TEST-NOTIF-2';

    var networkId = null;
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

    describe('#Poll', function () {
        it('should return new notification when adding notification with specified name', function (done) {
            var params = {user: user};
            var $path = path.combine(path.current, path.POLL);
            params.query = path.query('names', NOTIFICATION);
            utils.get($path, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true);
                assert.strictEqual(result.every(function (item) {
                    return item.notification === NOTIFICATION;
                }), true);
                done();
            })

            setTimeout(function () {
                var params = helper.getParamsObj(NOTIFICATION_2, user);
                utils.create(path.current, params, function (err) {
                    assert.strictEqual(!(!err), false, 'No error');
                });
            }, 100);

            setTimeout(function () {
                var params = helper.getParamsObj(NOTIFICATION, user);
                utils.create(path.current, params, function (err) {
                    assert.strictEqual(!(!err), false, 'No error');
                });
            }, 100);
        })
    });

    describe('#Poll No Wait', function () {
        it('should return immediately with empty result', function (done) {
            var params = {user: user};
            var $path = path.combine(path.current, path.POLL);
            params.query = path.query('waitTimeout', '0');
            utils.get($path, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isEmptyArray(result), true);
                done();
            })
        })
    });

    describe('#Poll Many', function () {
        it('should return result with deviceGuid', function (done) {
            var params = {user: user};
            params.query = path.query('names', NOTIFICATION, 'deviceGuids', DEVICE_GUID);
            utils.get(path.NOTIFICATION.poll(), params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true);
                assert.strictEqual(result.every(function (item) {
                    return item.notification.notification === NOTIFICATION && item.deviceGuid === DEVICE_GUID;
                }), true);
                done();
            })

            setTimeout(function () {
                var params = helper.getParamsObj(NOTIFICATION_2, user);
                utils.create(path.current, params, function (err) {
                    assert.strictEqual(!(!err), false, 'No error');
                });
            }, 100);

            setTimeout(function () {
                var params = helper.getParamsObj(NOTIFICATION, user);
                utils.create(path.current, params, function (err) {
                    assert.strictEqual(!(!err), false, 'No error');
                });
            }, 100);
        })
    });

    describe('#Poll Many - Other Device', function () {

        var OTHER_NETWORK = '_integr-test-OTHER-network-notif';
        var otherNetworkId = null;
        var OTHER_DEVICE_GUID = 'OTHER-DEVICE-NOTIF-GUID-1234'

        before(function (done) {

            function createNetwork(callback) {
                var params = {
                    user: utils.admin,
                    data: {
                        name: OTHER_NETWORK
                    }
                };

                utils.create(path.NETWORK, params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    otherNetworkId = result.id;
                    callback()
                });
            }

            function createDevice(callback) {
                var params = utils.device.getParamsObj('_integr-test-OTHER-device-notif', utils.admin, DEVICE_KEY,
                    {name: OTHER_NETWORK}, {name: DEVICE, version: '1'});
                params.id = OTHER_DEVICE_GUID;
                utils.update(path.DEVICE, params, function (err) {
                    callback(err);
                });
            }

            async.series([
                createNetwork,
                createDevice
            ], done);
        });

        it('should return notification for current device', function (done) {
            var params = {user: user};
            utils.get(path.NOTIFICATION.poll(), params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true);
                assert.strictEqual(result.every(function (item) {
                    return item.notification.notification === NOTIFICATION_2 && item.deviceGuid === DEVICE_GUID;
                }), true);
                done();
            })

            setTimeout(function () {
                var params = helper.getParamsObj(NOTIFICATION_2, null);
                params.device = {
                    id: OTHER_DEVICE_GUID,
                    key: DEVICE_KEY
                };
                utils.create(path.NOTIFICATION.get(OTHER_DEVICE_GUID), params, function (err) {
                    assert.strictEqual(!(!err), false, 'No error');
                });
            }, 100);

            setTimeout(function () {
                var params = helper.getParamsObj(NOTIFICATION_2, utils.admin);
                utils.create(path.current, params, function (err) {
                    assert.strictEqual(!(!err), false, 'No error');
                });
            }, 100);
        })
    });

    describe('#Poll Many No Wait', function () {
        it('should return immediately with empty result', function (done) {
            var params = {user: user};
            params.query = path.query('waitTimeout', '0');
            utils.get(path.NOTIFICATION.poll(), params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isEmptyArray(result), true);
                done();
            })
        })
    });

    describe('#Create', function () {

        var invalidAccessKey1 = null;
        var invalidAccessKey2 = null;
        var invalidAccessKey3 = null;
        var accessKey = null;

        before(function (done) {

            var params = [
                {
                    user: nonNetworkUser,
                    actions: 'CreateDeviceNotification'
                },
                {
                    user: user,
                    actions: 'CreateDeviceNotification',
                    networkIds: [0]
                },
                {
                    user: user,
                    actions: 'CreateDeviceNotification',
                    deviceIds: utils.NON_EXISTING_ID
                },
                {
                    user: user,
                    actions: 'CreateDeviceNotification'
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
            })
        });

        it('should create notification using device authorization', function (done) {
            var params = helper.getParamsObj(NOTIFICATION, null);
            params.device = {
                id: DEVICE_GUID,
                key: DEVICE_KEY
            };
            utils.create(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                var params = helper.getParamsObj(NOTIFICATION, user);
                params.id = result.id;
                var timestamp = result.timestamp;
                utils.get(path.current, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    assert.strictEqual(result.notification, NOTIFICATION);
                    assert.strictEqual(new Date(result.timestamp).toUTCString(),
                        new Date(timestamp).toUTCString());
                    done();
                })
            });
        })

        it('should return error when creating notification with invalid user', function (done) {
            var params = helper.getParamsObj(NOTIFICATION, nonNetworkUser);
            utils.create(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, format('DeviceHive server error - Device with such guid = %s not found',
                    DEVICE_GUID));
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);

                done();
            })
        });

        it('should succeed when creating notification with allowed user', function (done) {
            var params = helper.getParamsObj(NOTIFICATION, user);
            utils.create(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');

                var timestamp = result.timestamp;
                params.id = result.id;
                utils.get(path.current, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    assert.strictEqual(result.notification, NOTIFICATION);
                    assert.strictEqual(new Date(result.timestamp).toUTCString(),
                        new Date(timestamp).toUTCString());
                    done();
                })
            })
        });

        it('should fail with 404 #1', function (done) {
            var params = helper.getParamsObj(NOTIFICATION);
            params.accessKey = invalidAccessKey1;
            utils.create(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, format('DeviceHive server error - Device with such guid = %s not found',
                    DEVICE_GUID));
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);

                done();
            });
        });

        it('should fail with 404 #2', function (done) {
            var params = helper.getParamsObj(NOTIFICATION);
            params.accessKey = invalidAccessKey2;
            utils.create(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, format('DeviceHive server error - Device with such guid = %s not found',
                    DEVICE_GUID));
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);

                done();
            });
        });

        it('should fail with 404 #3', function (done) {
            var params = helper.getParamsObj(NOTIFICATION);
            params.accessKey = invalidAccessKey3;
            utils.create(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, format('DeviceHive server error - Device with such guid = %s not found',
                    DEVICE_GUID));
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);

                done();
            });
        });

        it('should succeed when using valid access key', function (done) {
            var params = helper.getParamsObj(NOTIFICATION);
            params.accessKey = accessKey;
            utils.create(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                done();
            });
        });
    })

    after(function (done) {
        utils.clearResources(done);
    });
});