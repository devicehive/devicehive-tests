var async = require('async');
var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API Notification', function () {
    this.timeout(90000);
    var url = null;

    var DEVICE = utils.getName('ws-notif-device');
    var NETWORK = utils.getName('ws-notif-network');
    var NETWORK_KEY = utils.getName('ws-notif-network-key');

    var NOTIFICATION = utils.getName('ws-notification');
    var NOTIFICATION1 = utils.getName('ws-notification-1');
    var NOTIFICATION2 = utils.getName('ws-notification-2');

    var deviceId = utils.getName('ws-notif-device-id');
    var user = null;
    var token = null;
    var invalidToken = null;
    var device = null;
    var notificationId1 = null;
    var notificationId2 = null;

    var clientToken = null;
    var refreshToken = null;
    var clientInvalidToken = null;

    before(function (done) {
        var networkId = null;

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

        function createUser(callback) {
            utils.createUser2(1, networkId, function (err, result) {
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
                    'GetDeviceNotification',
                    'CreateDeviceNotification'
                ],
                deviceIds: deviceId,
                networkIds: networkId
            };
            utils.jwt.create(user.id, args.actions, args.networkIds, args.deviceIds , function (err, result) {
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
                deviceIds: deviceId,
                networkIds: networkId
            };
            utils.jwt.create(user.id, args.actions, args.networkIds, args.deviceIds, function (err, result) {
                if (err) {
                    return callback(err);
                }
                invalidToken = result.accessToken;
                callback()
            })
        }

        function createConn(callback) {
            device = new Websocket(url);
            device.connect(callback);
        }

        function createConnTokenAuth(callback) {
            clientToken = new Websocket(url);
            clientToken.connect(callback);
        }

        function createConnInvalidTokenAuth(callback) {
            clientInvalidToken = new Websocket(url);
            clientInvalidToken.connect(callback);
        }

        function createConnRefreshTokenAuth(callback) {
            refreshToken = new Websocket(url);
            refreshToken.connect(callback);
        }

        function authenticateWithToken(callback) {
            clientToken.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: token
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

        function authenticateConn(callback) {
            device.params({
                action: 'authenticate',
                requestId: getRequestId(),
                token: token
            })
                .send(callback);
        }

        async.series([
            getWsUrl,
            createNetwork,
            createUser,
            createDevice,
            insertNotification1,
            insertNotification2,
            createToken,
            createInvalidToken,
            createConn,
            createConnTokenAuth,
            createConnInvalidTokenAuth,
            createConnRefreshTokenAuth,
            authenticateWithToken,
            authenticateWithInvalidToken,
            authenticateConn
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
                    .expect(notification)
                    .send(done);
            }
        }

        it('should add new notification, jwt auth', function (done) {
            runTest(clientToken, done);
        });

        it('should fail when using wrong jwt', function (done) {
            clientInvalidToken.params({
                    action: 'notification/insert',
                    requestId: getRequestId(),
                    notification: notification
                })
                .expectError(401, 'Unauthorized')
                .send(done);
        });

        it('should authenticate fail when using refresh token', function (done) {
            device.params({
                action: 'authenticate',
                requestId: getRequestId(),
                token: utils.jwt.admin_refresh
            })
                .expectError(401, 'Invalid credentials')
                .send(done);
        });

        it('should fail when using wrong deviceId', function (done) {
            var invalidDeviceId = 'invalid-device-id';  
            device.params({
                action: 'notification/insert',
                requestId: getRequestId(),
                deviceId: invalidDeviceId,
                notification: notification
            })
                .expectError(404, 'Device with such deviceId = ' + invalidDeviceId + ' not found')
                .send(done);
        });

        it('should fail when no deviceId is provided', function (done) {
            clientToken.params({
                action: 'notification/insert',
                requestId: getRequestId(),
                notification: notification
            })
                .expectError(400, 'Device id is wrong or empty')
                .send(done);
        });
    });

    describe('#notification/list', function () {

        function runTest(client, done) {
            var requestId = getRequestId();
            client.params({
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

                    assert.equal(areNotificationsInList, true, "Commands with required ids are not in the list");
                })
                .send(done);
        }

        it('should check if inserted notifications are in results', function (done) {
            runTest(clientToken, done);
        });

        it('should fail when using wrong jwt', function (done) {
            clientInvalidToken.params({
                action: 'notification/list',
                requestId: getRequestId(),
                deviceId: deviceId
            })
                .expectError(401, 'Unauthorized')
                .send(done);
        });

        it('should fail when using wrong deviceId', function (done) {
            var invalidDeviceId = 'invalid-device-id';
            device.params({
                action: 'notification/list',
                requestId: getRequestId(),
                deviceId: invalidDeviceId
            })
                .expectError(404, 'Device with such deviceId = ' + invalidDeviceId + ' not found')
                .send(done);
        });

        it('should fail when no deviceId is provided', function (done) {
            clientToken.params({
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
            runTest(clientToken, done);
        });

        it('should fail when using wrong jwt', function (done) {
            clientInvalidToken.params({
                action: 'notification/get',
                requestId: getRequestId(),
                deviceId: deviceId,
                notificationId: notificationId1
            })
                .expectError(401, 'Unauthorized')
                .send(done);
        });

        it('should fail when using wrong deviceId', function (done) {
            var invalidDeviceId = 'invalid-device-id';
            device.params({
                action: 'notification/get',
                requestId: getRequestId(),
                deviceId: invalidDeviceId,
                notificationId: notificationId1
            })
                .expectError(404, 'Device with such deviceId = ' + invalidDeviceId + ' not found')
                .send(done);
        });

        it('should fail when no deviceId is provided', function (done) {
            clientToken.params({
                action: 'notification/get',
                requestId: getRequestId(),
                notificationId: notificationId1
            })
                .expectError(400, 'Device id is wrong or empty')
                .send(done);
        });

        it('should fail when no notificationId is provided', function (done) {
            clientToken.params({
                action: 'notification/get',
                requestId: getRequestId(),
                deviceId: deviceId
            })
                .expectError(400, 'Notification id is wrong or empty')
                .send(done);
        });

        it('should fail when not integer notificationId is provided', function (done) {
            var invalidNotificationId = 'invalid-notification-id';
            
            clientToken.params({
                action: 'notification/get',
                requestId: getRequestId(),
                deviceId: deviceId,
                notificationId: invalidNotificationId
            })
                .expectError(400, 'Notification id is wrong or empty')
                .send(done);
        });

        it('should fail when not existing notificationId is provided', function (done) {
            var invalidNotificationId = 123454321;

            clientToken.params({
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

        function runTest(client, done) {
            var requestId = getRequestId();
            var subscriptionId = null;
            client.params({
                    action: 'notification/subscribe',
                    requestId: requestId,
                    deviceIds: [deviceId],
                    names: [NOTIFICATION]
                })
                .expect({
                    action: 'notification/subscribe',
                    requestId: requestId,
                    status: 'success'
                })
                .expectTrue(function (result) {
                    return utils.core.hasStringValue(result.subscriptionId);
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
            runTest(clientToken, done);
        });

        it('should subscribe to all device notifications, device auth', function (done) {
            var requestId = getRequestId();

            device.params({
                action: 'notification/subscribe',
                requestId: requestId
            })
                .expect({
                    action: 'notification/subscribe',
                    requestId: requestId,
                    status: 'success'
                })
                .send(onSubscribed);

            function onSubscribed(err) {
                if (err) {
                    return done(err);
                }

                device.waitFor('notification/insert', cleanUp)
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

                    device.params({
                        action: 'notification/unsubscribe',
                        requestId: getRequestId()
                    })
                        .send(done);
                }
            }
        });

        it('should subscribe to device notifications for single device', function (done) {
            var requestId = getRequestId();

            device.params({
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

            function onSubscribed(err) {
                if (err) {
                    return done(err);
                }

                device.waitFor('notification/insert', cleanUp)
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

                    device.params({
                        action: 'notification/unsubscribe',
                        requestId: getRequestId()
                    })
                        .send(done);
                }
            }
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
                    utils.matches(err, {message: 'waitFor() timeout: hasn\'t got message \'notification/insert\' for 2000ms'});
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
            runTest(clientToken, done);
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
            runTest(clientToken, done);
        });

        function runTestNoSubscr(client, done) {

            var notification = {
                notification: NOTIFICATION,
                parameters: {a: '3', b: '4'}
            };

            client.waitFor('notification/insert', function (err) {
                assert.strictEqual(!(!err), true, 'Commands should not arrive');
                utils.matches(err, {message: 'waitFor() timeout: hasn\'t got message \'notification/insert\' for 2000ms'});
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
            runTestNoSubscr(clientToken, done);
        });
    });

    after(function (done) {
        clientToken.close();
        utils.clearDataJWT(done);
    });
});
