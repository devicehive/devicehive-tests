var assert = require('assert');
var async = require('async');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;

describe('REST API Device Notification', function () {
    this.timeout(90000);

    var helper = utils.notification;

    var NETWORK = utils.getName('network-device-notif');
    var DEVICE = utils.getName('device-notif');
    var DEVICE_GUID = utils.getName('guid-notif-12345');
    var NOTIFICATION = utils.getName('notif-1');
    var NOTIFICATION_2 = utils.getName('notif-2');

    var user = null;
    var nonNetworkUser = null;
    var notificationId = null;
    var beforeCreateNotificationTimestamp = new Date().getTime();

    var networkId = null;

    var jwt1 = null;
    var jwt2 = null;

    function hasNotification(item) {
        return item.id === notificationId && item.notification === NOTIFICATION;
    }

    before(function (done) {
        path.current = path.NOTIFICATION.get(DEVICE_GUID);

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

        function createDeviceClass(callback) {
            var params = utils.deviceClass.getParamsObj(DEVICE, utils.jwt.admin, '1');
            utils.create(path.DEVICE_CLASS, params, function (err) {
                callback(err);
            });
        }

        function createDevice(callback) {
            var params = utils.device.getParamsObj(DEVICE, utils.jwt.admin,
                networkId, {name: DEVICE, version: '1'});
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

        function createJWTs(callback) {
            var params = [
                {
                    user: user,
                    actions: ['GetDeviceNotification','CreateDeviceNotification'],
                    networkIds: networkId,
                    deviceIds: DEVICE_GUID
                },
                {
                    user: nonNetworkUser,
                    actions: ['GetDeviceNotification','CreateDeviceNotification'],
                    networkIds: void 0,
                    deviceIds: DEVICE_GUID
                }
            ];

            utils.jwt.createMany(params, function (err, result) {
                if (err) {
                    return callback(err);
                }

                jwt1 = result[0];
                jwt2 = result[1];

                callback();
            })
        }

        async.series([
            createNetwork,
            createDeviceClass,
            createDevice,
            createUser,
            createNonNetworkUser,
            createJWTs
        ], done);
    });

    describe('#Get All', function () {

        before(function (done) {
            var params = helper.getParamsObj(NOTIFICATION, jwt1);
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

        it('should get all notifications for valid jwt', function (done) {
            utils.get(path.current, {jwt: jwt1}, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 3), true, 'Is array of 3 objects');

                assert.strictEqual(result.some(function (item) {
                    return item.notification === '$device-add';
                }), true, 'Has $device-add notification');

                assert.strictEqual(result.some(hasNotification), true);

                done();
            })
        });

        it('should get notifications having same name when using name query', function (done) {
            var params = {jwt: jwt1};
            params.query = path.query('notification', NOTIFICATION);
            setTimeout(function() {
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
            }, 200);
        });

        it('should get notifications by start date', function (done) {
            var params = {jwt: jwt1};
            var date = new Date();
            date.setHours(date.getHours() - 1);
            params.query = path.query('start', date.toISOString());
            setTimeout(function() {
                utils.get(path.current, params, function (err, result) {
                    assert.strictEqual(!(!err), false, 'No error');
                    assert.strictEqual(utils.core.isArrayOfLength(result, 3), true, 'Is array of 3 objects');

                    assert.strictEqual(result.some(hasNotification), true);

                    done();
                })
            }, 400);
        });

        it('should return empty notifications list when start date is out of range', function (done) {
            var params = {jwt: jwt1};
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
            var params = {jwt: jwt1};
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
                    actions: 'GetDeviceNotification',
                    networkIds: networkId,
                    deviceIds: DEVICE_GUID
                }
            ];

            utils.jwt.createMany(params, function (err, result) {
                if (err) {
                    return done(err);
                }

                invalidJWT1 = result[0];
                invalidJWT2 = result[1];
                invalidJWT3 = result[2];
                jwt = result[3];

                var params = helper.getParamsObj(NOTIFICATION, utils.jwt.admin);

                utils.create(path.NOTIFICATION.get(DEVICE_GUID), params, function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    notificationId = result.id;
                    done(err);
                });
            })
        });

        it('should fail with 404 #1', function (done) {
            var params = {jwt: invalidJWT1};
            utils.get(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Unauthorized');
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);

                done();
            });
        });

        it('should fail with 404 #2', function (done) {
            var params = {jwt: invalidJWT2};
            utils.get(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Unauthorized');
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);

                done();
            });
        });

        it('should fail with 404 #3', function (done) {
            var params = {jwt: invalidJWT3};
            utils.get(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Unauthorized');
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);

                done();
            });
        });

        it('should succeed when using valid access key', function (done) {
            var params = {jwt: jwt};
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
            var params = {jwt: jwt1};
            var $path = path.combine(path.current, path.POLL);
            params.query = path.query('names', NOTIFICATION);
            utils.get($path, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true);
                assert.strictEqual(result.every(function (item) {
                    return item.notification === NOTIFICATION;
                }), true);
                done();
            });

            setTimeout(function () {
                var params = helper.getParamsObj(NOTIFICATION_2, jwt1);
                utils.create(path.current, params, function () {});
            }, 100);

            setTimeout(function () {
                var params = helper.getParamsObj(NOTIFICATION, jwt1);
                utils.create(path.current, params, function () {});
            }, 100);
        });

        it('should return array with notifications when poll with waitTimeout=3', function (done) {
            var params = {jwt: jwt1};
            var $path = path.combine(path.current, path.POLL);
            params.query = path.query('waitTimeout', 3, 'deviceGuid', DEVICE);
            utils.get($path, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(result.length > 0, true);
                done();
            });

            setTimeout(function () {
                var params = helper.getParamsObj(NOTIFICATION, jwt1);
                utils.create(path.current, params, function () {});
            }, 100);
        })
    });

    describe('#Poll No Wait', function () {
        it('should return immediately with empty result', function (done) {
            var params = {jwt: jwt1};
            var $path = path.combine(path.current, path.POLL);
            params.query = path.query('waitTimeout', '0');
            utils.get($path, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isEmptyArray(result), true);
                done();
            })
        });

        it('should return immediately array with notifications when poll with waitTimeout=0 and timestamp', function (done) {
            var params = {jwt: jwt1};
            var $path = path.combine(path.current, path.POLL);
            params.query = path.query('waitTimeout', '0', 'timestamp', beforeCreateNotificationTimestamp);
            utils.get($path, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(result.length > 0, true);
                done();
            })
        })
    });

    describe('#Poll Many', function () {
        it('should return result with deviceGuid', function (done) {
            var params = {jwt: jwt1};
            params.query = path.query('names', NOTIFICATION, 'deviceGuids', DEVICE_GUID);
            utils.get(path.NOTIFICATION.poll(), params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true);
                assert.strictEqual(result.every(function (item) {
                    return item.notification === NOTIFICATION && item.deviceGuid === DEVICE_GUID;
                }), true);
                done();
            });

            setTimeout(function () {
                var params = helper.getParamsObj(NOTIFICATION_2, jwt1);
                utils.create(path.current, params, function () {});
            }, 100);

            setTimeout(function () {
                var params = helper.getParamsObj(NOTIFICATION, jwt1);
                utils.create(path.current, params, function () {});
            }, 100);
        })
    });

    describe('#Poll Many - Other Device', function () {

        var OTHER_NETWORK = utils.getName('other-network-notif');
        var otherNetworkId = null;
        var OTHER_DEVICE_GUID = 'other-notif-guid-1234';

        before(function (done) {

            function createNetwork(callback) {
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
                    callback()
                });
            }

            function createDevice(callback) {
                var params = utils.device.getParamsObj(utils.getName('other-device-notif'), utils.jwt.admin,
                    otherNetworkId, {name: DEVICE, version: '1'});
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
            var params = {jwt: jwt1};
            utils.get(path.NOTIFICATION.poll(), params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isArrayOfLength(result, 1), true);
                assert.strictEqual(result.every(function (item) {
                    return item.notification === NOTIFICATION_2 && item.deviceGuid === DEVICE_GUID;
                }), true);
                done();
            });

            setTimeout(function () {
                var params = helper.getParamsObj(NOTIFICATION_2, utils.jwt.admin);
                utils.create(path.NOTIFICATION.get(OTHER_DEVICE_GUID), params, function () {});
            }, 100);

            setTimeout(function () {
                var params = helper.getParamsObj(NOTIFICATION_2, utils.jwt.admin);
                utils.create(path.current, params, function () {});
            }, 100);
        })
    });

    describe('#Poll Many No Wait', function () {
        it('should return immediately with empty result', function (done) {
            var params = {jwt: jwt1};
            params.query = path.query('waitTimeout', '0');
            utils.get(path.NOTIFICATION.poll(), params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                assert.strictEqual(utils.core.isEmptyArray(result), true);
                done();
            })
        })
    });

    describe('#Create', function () {

        var invalidJWT1 = null;
        var invalidJWT2 = null;
        var invalidJWT3 = null;
        var jwt = null;

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
                    actions: 'CreateDeviceNotification',
                    networkIds: networkId,
                    deviceIds: DEVICE_GUID
                }
            ];

            utils.jwt.createMany(params, function (err, result) {
                if (err) {
                    return done(err);
                }

                invalidJWT1 = result[0];
                invalidJWT2 = result[1];
                invalidJWT3 = result[2];
                jwt = result[3];

                done();
            })
        });

        it('should fail with 404 #1', function (done) {
            var params = helper.getParamsObj(NOTIFICATION);
            params.jwt = invalidJWT1;
            utils.create(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Unauthorized');
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);

                done();
            });
        });

        it('should fail with 404 #2', function (done) {
            var params = helper.getParamsObj(NOTIFICATION);
            params.jwt = invalidJWT2;
            utils.create(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Unauthorized');
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);

                done();
            });
        });

        it('should fail with 404 #3', function (done) {
            var params = helper.getParamsObj(NOTIFICATION);
            params.jwt = invalidJWT3;
            utils.create(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Unauthorized');
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);

                done();
            });
        });

        it('should succeed when using valid jwt', function (done) {
            var params = helper.getParamsObj(NOTIFICATION);
            params.jwt = jwt;
            utils.create(path.current, params, function (err) {
                assert.strictEqual(!(!err), false, 'No error');
                done();
            });
        });

        it('should succeed when trying to create notification with timestamp', function (done) {
            var timestamp = new Date().toISOString();
            var params = helper.getParamsObj(NOTIFICATION, null, null, timestamp);
            params.jwt = jwt;
            utils.create(path.current, params, function (err, result) {
                assert.strictEqual(!(!err), false, 'No error');
                var resultDate = new Date(result.timestamp).toISOString();
                assert.strictEqual(resultDate, timestamp);

                done();
            });
        });
    });

    describe('#Update', function () {
        it('should return error when trying to update notification', function (done) {
            var params = {
                data: {
                    parameters: { a: 'b' }
                },
                jwt: utils.jwt.admin
            };
            params.id = notificationId;
            utils.update(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'HTTP 405 Method Not Allowed');
                assert.strictEqual(err.httpStatus, status.METHOD_NOT_ALLOWED);

                done();
            });
        });
    });

    describe('#Delete', function () {
        it('should return error when trying to delete notification', function (done) {
            var params = {jwt: utils.jwt.admin};
            params.id = notificationId;
            utils.delete(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'HTTP 405 Method Not Allowed');
                assert.strictEqual(err.httpStatus, status.METHOD_NOT_ALLOWED);
                done();
            });
        })
    });

    describe('#Bad Request', function () {
        it('should return error when trying to create notification using invalid format', function (done) {
            var params = {
                data: {
                    notification2: NOTIFICATION
                }
            };
            params.jwt = jwt1;
            utils.create(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Invalid request parameters');
                assert.strictEqual(err.httpStatus, status.BAD_REQUEST);
                done();
            });
        })
    });

    describe('#Unauthorized', function () {
        describe('#No Authorization', function () {
            it('should return error when getting notifications without authorization', function (done) {
                utils.get(path.current, {jwt: null}, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            });

            it('should return error when getting notifications with jwt refresh token', function (done) {
                utils.get(path.current, {jwt: utils.jwt.admin_refresh}, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            });

            it('should return error when accessing non-existing notification without authorization', function (done) {
                var params = {jwt: null };
                params.id = utils.NON_EXISTING_ID;
                utils.get(path.current, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            });

            it('should return error when inserting notification without authorization', function (done) {
                var params = helper.getParamsObj('the-notification', null);
                utils.create(path.current, params, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            });

            it('should return error when polling notifications without authorization #1', function (done) {
                var $path = path.combine(path.current, path.POLL);
                utils.get($path, {jwt: null}, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            });

            it('should return error when polling notifications without authorization #2', function (done) {
                utils.get(path.NOTIFICATION.poll(), {jwt: null}, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'Unauthorized');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                })
            });
        });
    });

    describe('#Not Found', function () {
        it('should return error when accessing non-existing notification', function (done) {
            var params = {jwt: utils.jwt.admin };
            params.id = utils.NON_EXISTING_ID;
            utils.get(path.current, params, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error,
                    format('Notification with id = %s not found', params.id));
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);
                done();
            })
        });
    });

    after(function (done) {
        utils.clearDataJWT(done);
    });
});
