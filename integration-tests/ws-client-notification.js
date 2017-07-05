var async = require('async');
var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API Client Notification', function () {
    this.timeout(90000);
    var url = null;

    var DEVICE = utils.getName('ws-notif-device');
    var NETWORK = utils.getName('ws-notif-network');
    var NETWORK_KEY = utils.getName('ws-notif-network-key');

    var NOTIFICATION = utils.getName('ws-notification');

    var deviceId = utils.getName('ws-notif-device-id');
    var user = null;
    var token = null;
    var adminToken = null;
    var invalidToken = null;

    var clientToken = null;
    var adminValidToken = null;
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

        function createAdminToken(callback) {
            adminToken = utils.jwt.admin;
            callback();
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

        function createConnTokenAuth(callback) {
            clientToken = new Websocket(url, 'client');
            clientToken.connect(callback);
        }

        function createConnAdminTokenAuth(callback) {
            adminValidToken = new Websocket(url, 'client');
            adminValidToken.connect(callback);
        }


        function createConnInvalidTokenAuth(callback) {
            clientInvalidToken = new Websocket(url, 'client');
            clientInvalidToken.connect(callback);
        }

        function createConnRefreshTokenAuth(callback) {
            refreshToken = new Websocket(url, 'client');
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

        function authenticateWithAdminToken(callback) {
            adminValidToken.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: adminToken
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
            createUser,
            createDevice,
            createToken,
            createAdminToken,
            createInvalidToken,
            createConnTokenAuth,
            createConnAdminTokenAuth,
            createConnInvalidTokenAuth,
            createConnRefreshTokenAuth,
            authenticateWithToken,
            authenticateWithAdminToken,
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

        it('should not fail for user with one device available', function (done) {
            clientToken.params({
                action: 'notification/insert',
                requestId: getRequestId(),
                notification: notification
            })
                .expect({
                    "status": "success"
                })
                .send(done);
        });
        
        it('should not fail for user with all device available', function (done) {
            adminValidToken.params({
                action: 'notification/insert',
                requestId: getRequestId(),
                notification: notification
            })
                .expect({
                    "status": "success"
                })
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
                        deviceId: deviceId,
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
                        deviceId: deviceId,
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
