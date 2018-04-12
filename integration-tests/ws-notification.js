var async = require('async');
var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var status = require('./common/http').status;
var format = require('util').format;
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API Notification', function () {
    this.timeout(90000);
    var url = null;

    var DEVICE = utils.getName('ws-notif-device');
    var NETWORK = utils.getName('ws-notif-network');
    var NETWORK_KEY = utils.getName('ws-notif-network-key');
    var DEVICE_1 = utils.getName('ws-cmd-device-1');
    var NETWORK_1 = utils.getName('ws-cmd-network-1');
    var NETWORK_KEY_1 = utils.getName('ws-cmd-network-key-1');

    var NOTIFICATION = utils.getName('ws-notification');
    var NOTIFICATION1 = utils.getName('ws-notification-1');
    var NOTIFICATION2 = utils.getName('ws-notification-2');

    var deviceId = utils.getName('ws-notif-device-id');
    var deviceId1 = utils.getName('ws-notif-device-id-1');
    var newDeviceId = utils.getName('ws-cmd-device-id-new');
    var user = null;
    var token = null;
    var invalidToken = null;
    var networkId = null;
    var networkId1 = null;
    var notificationId1 = null;
    var notificationId2 = null;
    var timestamp = null;

    var conn = null;
    var adminConn = null;
    var refreshToken = null;
    var clientInvalidToken = null;
    var startTestTimestamp = null;

    before(function (done) {
        function getWsUrl(callback) {

            req.get(path.INFO).params({jwt: utils.jwt.admin}).send(function (err, result) {
                if (err) {
                    return callback(err);
                }
                url = result.webSocketServerUrl;
                callback();
            });
        }

        function createNetwork(callback) {
            var params = {
                jwt: utils.jwt.admin,
                data: { name: NETWORK, key: NETWORK_KEY }
            };

            utils.create(path.NETWORK, params, function (err, result) {
                if (err) {
                    return callback(err);
                }

                networkId = result.id;
                callback();
            });
        }

        function createNetwork1(callback) {
            var params = {
                jwt: utils.jwt.admin,
                data: { name: NETWORK_1, key: NETWORK_KEY_1 }
            };

            utils.create(path.NETWORK, params, function (err, result) {
                if (err) {
                    return callback(err);
                }

                networkId1 = result.id;
                callback();
            });
        }

        function createUser(callback) {
            utils.createUser2(1, [networkId, networkId1], function (err, result) {
                if (err) {
                    return callback(err);
                }

                user = result.user;
                callback();
            });
        }

        function createDevice(callback) {
            req.update(path.get(path.DEVICE, deviceId))
                .params(utils.device.getParamsObj(DEVICE, utils.jwt.admin,
                    networkId, {name: DEVICE, version: '1'}))
                .send(callback);
        }

        function createDevice1(callback) {
            req.update(path.get(path.DEVICE, deviceId1))
                .params(utils.device.getParamsObj(DEVICE_1, utils.jwt.admin,
                    networkId1, {name: DEVICE_1, version: '1'}))
                .send(callback);
        }

        function insertNotification1(callback) {
            var params = {
                jwt: utils.jwt.admin,
                data: {
                    notification: NOTIFICATION1,
                    parameters: {a: '1', b: '1'}
                }
            };

            utils.create(path.NOTIFICATION.get(deviceId), params, function (err, result) {
                if (err) {
                    return callback(err);
                }

                notificationId1 = result.id;
                timestamp = new Date().toISOString();
                callback();
            });
        }

        function insertNotification2(callback) {
            var params = {
                jwt: utils.jwt.admin,
                data: {
                    notification: NOTIFICATION2,
                    parameters: {a: '2', b: '2'}
                }
            };

            utils.create(path.NOTIFICATION.get(deviceId), params, function (err, result) {
                if (err) {
                    return callback(err);
                }

                notificationId2 = result.id;
                callback();
            });
        }

        function createToken(callback) {
            var args = {
                actions: [
                    'RegisterDevice',
                    'GetDeviceNotification',
                    'CreateDeviceNotification'
                ],
                networkIds: [networkId],
                deviceTypeIds: [1]
            };
            utils.jwt.create(user.id, args.actions, args.networkIds, args.deviceTypeIds, function (err, result) {
                if (err) {
                    return callback(err);
                }
                token = result.accessToken;
                callback()
            })
        }

        function createInvalidToken(callback) {
            var args = {
                actions: [ 'GetNetwork' ],
                networkIds: [networkId, networkId1],
                deviceTypeIds: [1]
            };
            utils.jwt.create(user.id, args.actions, args.networkIds, args.deviceTypeIds, function (err, result) {
                if (err) {
                    return callback(err);
                }
                invalidToken = result.accessToken;
                callback()
            })
        }

        function createConn(callback) {
            conn = new Websocket(url);
            conn.connect(callback);
        }

        function createAdminConn(callback) {
            adminConn = new Websocket(url);
            adminConn.connect(callback);
        }

        function createConnInvalidTokenAuth(callback) {
            clientInvalidToken = new Websocket(url);
            clientInvalidToken.connect(callback);
        }

        function createConnRefreshTokenAuth(callback) {
            refreshToken = new Websocket(url);
            refreshToken.connect(callback);
        }

        function authenticateConn(callback) {
            conn.params({
                action: 'authenticate',
                requestId: getRequestId(),
                token: token
            })
                .send(callback);
        }

        function authenticateAdminConn(callback) {
            adminConn.params({
                action: 'authenticate',
                requestId: getRequestId(),
                token: utils.jwt.admin
            })
                .send(callback);
        }

        function authenticateWithInvalidToken(callback) {
            clientInvalidToken.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: invalidToken
                })
                .send(callback);
        }

        async.series([
            getWsUrl,
            createNetwork,
            createNetwork1,
            createUser,
            createDevice,
            createDevice1,
            insertNotification1,
            insertNotification2,
            createToken,
            createInvalidToken,
            createConn,
            createAdminConn,
            createConnInvalidTokenAuth,
            createConnRefreshTokenAuth,
            authenticateConn,
            authenticateAdminConn,
            authenticateWithInvalidToken
        ], done);
    });

    describe('#Invalid credentials', function(done) {
        it('should return error with refresh token', function() {
            refreshToken.params({
                action: 'authenticate',
                requestId: getRequestId(),
                token: utils.jwt.admin_refresh
            })
                .expectError(401, 'Invalid credentials')
                .send(done);
        });
    });

    describe('#notification/insert', function () {

        var notification = {
            notification: NOTIFICATION,
            parameters: {a: '1', b: '2'}
        };

        function runTest(client, done) {
            var requestId = getRequestId();
            client.params({
                    action: 'notification/insert',
                    requestId: requestId,
                    deviceId: deviceId,
                    notification: notification
                })
                .expect({
                    action: 'notification/insert',
                    status: 'success',
                    requestId: requestId
                })
                .assert(function (result) {
                    utils.hasPropsWithValues(result.notification, ['id', 'timestamp']);
                })
                .send(onInsert);

            function onInsert(err, result) {
                if (err) {
                    return done(err);
                }

                var notificationId = result.notification.id;
                req.get(path.NOTIFICATION.get(deviceId))
                    .params({jwt: token, id: notificationId})
                    .expect({id: notificationId})
                    .expect({networkId: networkId})
                    .expect(notification)
                    .send(done);
            }
        }

        it('should add new notification, jwt auth', function (done) {
            runTest(conn, done);
        });

        it('should fail when using wrong jwt', function (done) {
            clientInvalidToken.params({
                    action: 'notification/insert',
                    requestId: getRequestId(),
                    notification: notification
                })
                .expectError(403, 'Access is denied')
                .send(done);
        });

        it('should authenticate fail when using refresh token', function (done) {
            conn.params({
                action: 'authenticate',
                requestId: getRequestId(),
                token: utils.jwt.admin_refresh
            })
                .expectError(401, 'Invalid credentials')
                .send(done);
        });

        it('should fail with 403 when using wrong deviceId with client token', function (done) {
            var invalidDeviceId = 'invalid-device-id';  
            conn.params({
                action: 'notification/insert',
                requestId: getRequestId(),
                deviceId: invalidDeviceId,
                notification: notification
            })
                .expectError(403, 'Access is denied')
                .send(done);
        });

        it('should fail with 404 when using wrong deviceId with admin token', function (done) {
            var invalidDeviceId = 'invalid-device-id';
            adminConn.params({
                action: 'notification/insert',
                requestId: getRequestId(),
                deviceId: invalidDeviceId,
                notification: notification
            })
                .expectError(404, 'Device with such deviceId = ' + invalidDeviceId + ' not found')
                .send(done);
        });

        it('should fail when no deviceId is provided', function (done) {
            conn.params({
                action: 'notification/insert',
                requestId: getRequestId(),
                notification: notification
            })
                .expectError(400, 'Device id is wrong or empty')
                .send(done);
        });
    });

    describe('#notification/list', function () {

        it('should check if inserted notifications are in results', function (done) {
            var requestId = getRequestId();
            conn.params({
                action: 'notification/list',
                requestId: requestId,
                deviceId: deviceId
            })
                .expect({
                    action: 'notification/list',
                    status: 'success',
                    requestId: requestId
                })
                .assert(function (result) {
                    var notificationIds = result.notifications.map(function (notification) {
                        return notification.id;
                    });
                    var areNotificationsInList = notificationIds.indexOf(notificationId1) >= 0
                        && notificationIds.indexOf(notificationId2) >= 0;

                    assert.equal(areNotificationsInList, true, "Notifications with required ids are not in the list" + notificationIds);
                })
                .send(done);
        });

        it('should check if start timestamp limits notifications in results', function (done) {
            var requestId = getRequestId();
            conn.params({
                action: 'notification/list',
                requestId: requestId,
                start: timestamp,
                deviceId: deviceId
            })
                .expect({
                    action: 'notification/list',
                    status: 'success',
                    requestId: requestId
                })
                .assert(function (result) {
                    var notificationIds = result.notifications.map(function (notification) {
                        return notification.id;
                    });
                    var areNotificationsInList = notificationIds.indexOf(notificationId1) < 0
                        && notificationIds.indexOf(notificationId2) >= 0;

                    assert.equal(areNotificationsInList, true, 
                        "Notifications with required ids are not in the list" + notificationIds);
                })
                .send(done);
        });

        it('should check if notification with correct name is in results', function (done) {
            var requestId = getRequestId();
            conn.params({
                action: 'notification/list',
                requestId: requestId,
                notification: NOTIFICATION2,
                deviceId: deviceId
            })
                .expect({
                    action: 'notification/list',
                    status: 'success',
                    requestId: requestId
                })
                .assert(function (result) {
                    var notificationIds = result.notifications.map(function (notification) {
                        return notification.id;
                    });
                    var areNotificationsInList = notificationIds.indexOf(notificationId1) < 0
                        && notificationIds.indexOf(notificationId2) >= 0;

                    assert.equal(areNotificationsInList, true, "Commands with required ids are not in the list");
                })
                .send(done);
        });

        it('should fail when using wrong jwt', function (done) {
            clientInvalidToken.params({
                action: 'notification/list',
                requestId: getRequestId(),
                deviceId: deviceId
            })
                .expectError(403, 'Access is denied')
                .send(done);
        });

        it('should fail when using wrong deviceId', function (done) {
            var invalidDeviceId = 'invalid-device-id';
            conn.params({
                action: 'notification/list',
                requestId: getRequestId(),
                deviceId: invalidDeviceId
            })
                .expectError(404, 'Device with such deviceId = ' + invalidDeviceId + ' not found')
                .send(done);
        });

        it('should fail when no deviceId is provided', function (done) {
            conn.params({
                action: 'notification/list',
                requestId: getRequestId()
            })
                .expectError(400, 'Device id is wrong or empty')
                .send(done);
        });
    });

    describe('#notification/get', function () {

        function runTest(client, done) {
            var requestId = getRequestId();
            client.params({
                action: 'notification/get',
                requestId: requestId,
                deviceId: deviceId,
                notificationId: notificationId1
            }).expect({
                action: 'notification/get',
                status: 'success',
                requestId: requestId
            }).assert(function (result) {
                assert.equal(result.notification.id, notificationId1, "Notifications with required id is not returned");
            }).send(done);
        }

        it('should check if inserted commands are in results', function (done) {
            runTest(conn, done);
        });

        it('should fail when using wrong jwt', function (done) {
            clientInvalidToken.params({
                action: 'notification/get',
                requestId: getRequestId(),
                deviceId: deviceId,
                notificationId: notificationId1
            })
                .expectError(403, 'Access is denied')
                .send(done);
        });

        it('should fail when using wrong deviceId', function (done) {
            var invalidDeviceId = 'invalid-device-id';
            conn.params({
                action: 'notification/get',
                requestId: getRequestId(),
                deviceId: invalidDeviceId,
                notificationId: notificationId1
            })
                .expectError(404, 'Device with such deviceId = ' + invalidDeviceId + ' not found')
                .send(done);
        });

        it('should fail when no deviceId is provided', function (done) {
            conn.params({
                action: 'notification/get',
                requestId: getRequestId(),
                notificationId: notificationId1
            })
                .expectError(400, 'Device id is wrong or empty')
                .send(done);
        });

        it('should fail when no notificationId is provided', function (done) {
            conn.params({
                action: 'notification/get',
                requestId: getRequestId(),
                deviceId: deviceId
            })
                .expectError(400, 'Notification id is wrong or empty')
                .send(done);
        });

        it('should fail when not integer notificationId is provided', function (done) {
            var invalidNotificationId = 'invalid-notification-id';
            
            conn.params({
                action: 'notification/get',
                requestId: getRequestId(),
                deviceId: deviceId,
                notificationId: invalidNotificationId
            })
                .expectError(400, 'Notification id should be an integer value.')
                .send(done);
        });

        it('should fail when not existing notificationId is provided', function (done) {
            var invalidNotificationId = 123454321;

            conn.params({
                action: 'notification/get',
                requestId: getRequestId(),
                deviceId: deviceId,
                notificationId: invalidNotificationId
            })
                .expectError(404, 'Requested notification not found')
                .send(done);
        });
    });

    describe('#notification/subscribe', function () {

        startTestTimestamp = new Date().toISOString();

        function runTest(client, done) {
            var requestId = getRequestId();
            var subscriptionId = null;
            client.params({
                    action: 'notification/subscribe',
                    requestId: requestId,
                    deviceId: deviceId,
                    names: [NOTIFICATION]
                })
                .expect({
                    action: 'notification/subscribe',
                    requestId: requestId,
                    status: 'success'
                })
                .expectTrue(function (result) {
                    return utils.core.hasNumericValue(result.subscriptionId);
                })
                .send(onSubscribed);

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                subscriptionId = result.subscriptionId;
                client.waitFor('notification/insert', cleanUp)
                    .expect({
                        action: 'notification/insert',
                        notification: { notification: NOTIFICATION },
                        subscriptionId: subscriptionId
                    });

                req.create(path.NOTIFICATION.get(deviceId))
                    .params({
                        jwt: token,
                        data: {notification: NOTIFICATION}
                    })
                    .send();
                
                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    client.params({
                            action: 'notification/unsubscribe',
                            requestId: getRequestId(),
                            subscriptionId: subscriptionId
                        })
                        .send(done);
                }
            }
        }

        it('should subscribe to device notifications, jwt authorization', function (done) {
            runTest(conn, done);
        });

        it('should subscribe to non existing device notifications, client jwt authorization', function (done) {
            var requestId = getRequestId();
            conn.params({
                action: 'notification/subscribe',
                requestId: requestId,
                deviceId: utils.NON_EXISTING_ID,
                names: [NOTIFICATION]
            })
                .expectError(status.FORBIDDEN, 'Access is denied')
                .send(done);
        });

        it('should subscribe to non existing device notifications, admin jwt authorization', function (done) {
            var requestId = getRequestId();
            adminConn.params({
                action: 'notification/subscribe',
                requestId: requestId,
                deviceId: utils.NON_EXISTING_ID,
                names: [NOTIFICATION]
            })
                .expectError(status.NOT_FOUND,
                    format('Device with such deviceId = %d not found', utils.NON_EXISTING_ID))
                .send(done);
        });

        it('should subscribe to all device notifications, device auth', function (done) {
            var requestId = getRequestId();
            var subscriptionId = null;

            conn.params({
                action: 'notification/subscribe',
                requestId: requestId
            })
                .expect({
                    action: 'notification/subscribe',
                    requestId: requestId,
                    status: 'success'
                })
                .send(onSubscribed);

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }
                subscriptionId = result.subscriptionId;

                conn.waitFor('notification/insert', cleanUp)
                    .expect({
                        action: 'notification/insert',
                        notification: { notification: NOTIFICATION }
                    });

                req.create(path.NOTIFICATION.get(deviceId))
                    .params({
                        jwt: utils.jwt.admin,
                        data: { notification: NOTIFICATION}
                    })
                    .send();

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    conn.params({
                        action: 'notification/unsubscribe',
                        requestId: getRequestId(),
                        subscriptionId: subscriptionId
                    })
                        .send(done);
                }
            }
        });

        it('should subscribe to device notifications for single device', function (done) {
            var requestId = getRequestId();
            var subscriptionId = null;

            conn.params({
                action: 'notification/subscribe',
                deviceId: deviceId,
                requestId: requestId
            })
                .expect({
                    action: 'notification/subscribe',
                    requestId: requestId,
                    status: 'success'
                })
                .send(onSubscribed);

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }
                subscriptionId = result.subscriptionId;

                conn.waitFor('notification/insert', cleanUp)
                    .expect({
                        action: 'notification/insert',
                        notification: { notification: NOTIFICATION }
                    });

                req.create(path.NOTIFICATION.get(deviceId))
                    .params({
                        jwt: utils.jwt.admin,
                        data: {notification: NOTIFICATION}
                    })
                    .send();

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    conn.params({
                        action: 'notification/unsubscribe',
                        requestId: getRequestId(),
                        subscriptionId: subscriptionId
                    })
                        .send(done);
                }
            }
        });

        it('should subscribe to device notifications for single network, returnUpdated = true', function (done) {
            var requestId = getRequestId();
            var subscriptionId = null;

            conn.params({
                action: 'notification/subscribe',
                networkIds: [networkId],
                returnUpdatedCommands: true,
                requestId: requestId
            })
                .expect({
                    action: 'notification/subscribe',
                    requestId: requestId,
                    status: 'success'
                })
                .send(onSubscribed);

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }
                subscriptionId = result.subscriptionId;

                conn.waitFor('notification/insert', cleanUp)
                    .expect({
                        action: 'notification/insert',
                        notification: { notification: NOTIFICATION }
                    });

                req.create(path.NOTIFICATION.get(deviceId))
                    .params({
                        jwt: utils.jwt.admin,
                        data: {notification: NOTIFICATION}
                    })
                    .send();

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    var requestId = getRequestId();
                    conn.params({
                        action: 'notification/unsubscribe',
                        requestId: requestId,
                        subscriptionId: subscriptionId
                    }).expect({
                        action: 'notification/unsubscribe',
                        requestId: requestId
                    })
                    
                        .send(done);
                }
            }
        });

        it('should subscribe to device notifications for multiple networks, returnUpdated = true', function (done) {
            var requestId = getRequestId();
            var subscriptionId = null;

            adminConn.params({
                action: 'notification/subscribe',
                networkIds: [networkId, networkId1],
                returnUpdatedCommands: true,
                requestId: requestId
            })
                .expect({
                    action: 'notification/subscribe',
                    requestId: requestId,
                    status: 'success'
                })
                .send(onSubscribed);

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }
                subscriptionId = result.subscriptionId;

                adminConn.waitFor('notification/insert', cleanUp)
                    .expect({
                        action: 'notification/insert',
                        notification: { notification: NOTIFICATION }
                    });

                req.create(path.NOTIFICATION.get(deviceId))
                    .params({
                        jwt: utils.jwt.admin,
                        data: {notification: NOTIFICATION}
                    })
                    .send();

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    var requestId = getRequestId();
                    adminConn.params({
                        action: 'notification/unsubscribe',
                        requestId: requestId,
                        subscriptionId: subscriptionId
                    }).expect({
                        action: 'notification/unsubscribe',
                        requestId: requestId
                    })
                        .send(done);
                }
            }
        });

        it('should subscribe to recently created device notifications for multiple networks', function (done) {
            var requestId = getRequestId();
            var subscriptionId = null;

            adminConn.params({
                action: 'notification/subscribe',
                networkIds: [networkId, networkId1],
                requestId: requestId
            })
                .expect({
                    action: 'notification/subscribe',
                    requestId: requestId,
                    status: 'success'
                })
                .send(connCreate);

            function connCreate(err, result) {
                if (err) {
                    return done(err);
                }

                subscriptionId = result.subscriptionId;

                adminConn.params({
                    action: 'device/save',
                    requestId: requestId,
                    deviceId: newDeviceId,
                    device: {
                        name: newDeviceId,
                        networkId: networkId
                    }
                })
                    .expect({
                        action: 'device/save',
                        requestId: requestId,
                        status: 'success'
                    })
                    .send(onSubscribed);
            }

            function onSubscribed(err) {
                if (err) {
                    return done(err);
                }

                adminConn.waitFor('notification/insert', cleanUp)
                    .expect({
                        action: 'notification/insert',
                        notification: { notification: NOTIFICATION },
                        subscriptionId: subscriptionId
                    });

                req.create(path.NOTIFICATION.get(newDeviceId))
                    .params({
                        jwt: utils.jwt.admin,
                        data: {notification: NOTIFICATION}
                    })
                    .send();
                
                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    adminConn.params({
                        action: 'device/delete',
                        requestId: requestId,
                        deviceId: newDeviceId
                    })
                        .expect({
                            action: 'device/delete',
                            requestId: requestId,
                            status: 'success'
                        })
                        .send(function (err) {
                            adminConn.params({
                                action: 'notification/unsubscribe',
                                requestId: getRequestId(),
                                subscriptionId: subscriptionId
                            })
                                .send(done);
                        });
                }
            }
        });

        it('should subscribe to recently created device notifications for global subscription', function (done) {
            var requestId = getRequestId();
            var subscriptionId = null;

            conn.params({
                action: 'notification/subscribe',
                requestId: requestId
            })
                .expect({
                    action: 'notification/subscribe',
                    requestId: requestId,
                    status: 'success'
                })
                .send(deviceCreate);

            function deviceCreate(err, result) {
                if (err) {
                    return done(err);
                }
                subscriptionId = result.subscriptionId;

                conn.params({
                    action: 'device/save',
                    requestId: requestId,
                    deviceId: newDeviceId,
                    device: {
                        name: newDeviceId,
                        networkId: networkId
                    }
                })
                    .expect({
                        action: 'device/save',
                        requestId: requestId,
                        status: 'success'
                    })
                    .send(onSubscribed);
            }

            function onSubscribed(err) {
                if (err) {
                    return done(err);
                }


                conn.waitFor('notification/insert', cleanUp)
                    .expect({
                        action: 'notification/insert',
                        notification: { notification: NOTIFICATION },
                        subscriptionId: subscriptionId
                    });

                req.create(path.NOTIFICATION.get(newDeviceId))
                    .params({
                        jwt: utils.jwt.admin,
                        data: {notification: NOTIFICATION}
                    })
                    .send();

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    conn.params({
                        action: 'device/delete',
                        requestId: requestId,
                        deviceId: newDeviceId
                    })
                        .expect({
                            action: 'device/delete',
                            requestId: requestId,
                            status: 'success'
                        })
                        .send(function (err) {
                            conn.params({
                                action: 'notification/unsubscribe',
                                requestId: getRequestId(),
                                subscriptionId: subscriptionId
                            })
                                .send(done);
                        });
                }
            }
        });

        it('should not subscribe to recently created device in different network for network subscription', function (done) {
            var requestId = getRequestId();

            adminConn.params({
                action: 'notification/subscribe',
                networkIds: [networkId1],
                requestId: requestId
            })
                .expect({
                    action: 'notification/subscribe',
                    requestId: requestId,
                    status: 'success'
                })
                .send(deviceCreate);

            function deviceCreate(err) {
                if (err) {
                    return done(err);
                }

                adminConn.params({
                    action: 'device/save',
                    requestId: requestId,
                    deviceId: newDeviceId,
                    device: {
                        name: newDeviceId,
                        networkId: networkId
                    }
                })
                    .expect({
                        action: 'device/save',
                        requestId: requestId,
                        status: 'success'
                    })
                    .send(onSubscribed);
            }

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                var subscriptionId = result.subscriptionId;

                adminConn.waitFor('notification/insert', function (err) {
                    assert.strictEqual(!(!err), true, 'Notifications should not arrive');
                    utils.matches(err, {message: 'waitFor() timeout: hasn\'t got message \'notification/insert\' for ' + utils.WEBSOCKET_TIMEOUT + 'ms'});
                    cleanUp();
                });

                req.create(path.NOTIFICATION.get(newDeviceId))
                    .params({
                        jwt: utils.jwt.admin,
                        data: {notification: NOTIFICATION}
                    })
                    .send();    
                
                    function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    adminConn.params({
                        action: 'device/delete',
                        requestId: requestId,
                        deviceId: newDeviceId
                    })
                        .expect({
                            action: 'device/delete',
                            requestId: requestId,
                            status: 'success'
                        })
                        .send(function (err) {
                            adminConn.params({
                                action: 'notification/unsubscribe',
                                requestId: getRequestId(),
                                subscriptionId: subscriptionId
                            })
                                .send(done);
                        });
                }
            }
        });

        it('should reject subscribe to device notifications for non existing network', function (done) {
            var requestId = getRequestId();

            conn.params({
                action: 'notification/subscribe',
                networkIds: [utils.NON_EXISTING_ID],
                requestId: requestId
            })
                .expectError(403, "Access is denied")
                .send(done);
        });

        it('should reject subscribe to device notifications for non existing network for admin', function (done) {
            var requestId = getRequestId();

            adminConn.params({
                action: 'notification/subscribe',
                networkIds: [utils.NON_EXISTING_ID],
                requestId: requestId
            })
                .expectError(404, "Networks with such networkIds wasn't found: {[" + utils.NON_EXISTING_ID + "]}")
                .send(done);
        });

        it('should reject subscribe to device notifications for non existing device type for admin', function (done) {
            var requestId = getRequestId();

            adminConn.params({
                action: 'notification/subscribe',
                deviceTypeIds: [utils.NON_EXISTING_ID],
                requestId: requestId
            })
                .expectError(404, "Device types with such deviceTypeIds wasn't found: {[" + utils.NON_EXISTING_ID + "]}")
                .send(done);
        });

        it('should reject subscribe to device notifications for empty device id for admin', function (done) {
            var requestId = getRequestId();

            adminConn.params({
                action: 'notification/subscribe',
                deviceId: "",
                requestId: requestId
            })
                .expectError(400, "Device id is wrong or empty")
                .send(done);
        });
    });

    describe('#notification/unsubscribe', function () {

        function runTest(client, done) {
            var subscriptionId = null;
            
            client.params({
                    action: 'notification/subscribe',
                    requestId: getRequestId(),
                    deviceIds: [deviceId],
                    names: [NOTIFICATION]
                })
                .send(onSubscribed);

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                var requestId = getRequestId();
                subscriptionId = result.subscriptionId;
                client.params({
                        action: 'notification/unsubscribe',
                        requestId: requestId,
                        subscriptionId: subscriptionId
                    })
                    .expect({
                        action: 'notification/unsubscribe',
                        status: 'success',
                        requestId: requestId
                    })
                    .send(onUnubscribed);
            }

            function onUnubscribed(err) {
                if (err) {
                    return done(err);
                }

                client.waitFor('notification/insert', function (err) {
                    assert.strictEqual(!(!err), true, 'Commands should not arrive');
                    utils.matches(err, {message: 'waitFor() timeout: hasn\'t got message \'notification/insert\' for ' + utils.WEBSOCKET_TIMEOUT + 'ms'});
                    done();
                });
                
                req.create(path.NOTIFICATION.get(deviceId))
                    .params({
                        jwt: utils.jwt.admin,
                        data: {notification: NOTIFICATION}
                    })
                    .send();    
            }
        }

        it('should subscribe to device notifications, jwt authorization', function (done) {
            runTest(conn, done);
        });
    });

    describe('#srv: notification/insert', function () {

        function runTest(client, done) {

            var subscriptionId = null;
            var notification = {
                notification: NOTIFICATION,
                parameters: {a: '1', b: '2'}
            };

            client.params({
                    action: 'notification/subscribe',
                    requestId: getRequestId(),
                    deviceIds: [deviceId],
                    names: [NOTIFICATION]
                })
                .send(onSubscribed);

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                subscriptionId = result.subscriptionId;
                client.waitFor('notification/insert', cleanUp)
                    .expect({
                        action: 'notification/insert',
                        notification: notification,
                        subscriptionId: subscriptionId
                    });

                req.create(path.NOTIFICATION.get(deviceId))
                    .params({
                        jwt: token,
                        data: notification
                    })
                    .send();

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    client.params({
                            action: 'notification/unsubscribe',
                            requestId: getRequestId(),
                            subscriptionId: subscriptionId
                        })
                        .send(done);
                }
            }
        }

        it('should notify when notification was inserted, jwt auth', function (done) {
            runTest(conn, done);
        });

        function runTestNoSubscr(client, done) {

            var notification = {
                notification: NOTIFICATION,
                parameters: {a: '3', b: '4'}
            };

            client.waitFor('notification/insert', function (err) {
                assert.strictEqual(!(!err), true, 'Commands should not arrive');
                utils.matches(err, {message: 'waitFor() timeout: hasn\'t got message \'notification/insert\' for ' + utils.WEBSOCKET_TIMEOUT + 'ms'});
                done();
            });

            req.create(path.NOTIFICATION.get(deviceId))
                .params({
                    jwt: token,
                    data: notification
                })
                .send();
        }

        it('should not notify when notification was inserted without prior subscription, jwt auth', function (done) {
            runTestNoSubscr(conn, done);
        });
    });

    after(function (done) {
        conn.close();
        utils.clearDataJWT(done);
    });
});
