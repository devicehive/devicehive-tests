var async = require('async');
var assert = require('assert');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API Client Notification', function () {
    var url = null;

    var DEVICE = utils.getName('ws-notif-device');
    var DEVICE_KEY = utils.getName('ws-notif-device-key');
    var NETWORK = utils.getName('ws-notif-network');
    var NETWORK_KEY = utils.getName('ws-notif-network-key');

    var NOTIFICATION = utils.getName('ws-notification');

    var deviceId = utils.getName('ws-notif-device-id');
    var user = null;
    var accessKey = null;
    var invalidKey = null;

    var clientUsr = null;
    var clientAK = null;
    var clientInvalidAK = null;

    before(function (done) {
        utils.clearOldEntities(function () {
            init(done);
        });
    });

    function init(done) {

        var networkId = null;

        function getWsUrl(callback) {

            req.get(path.INFO).params({user: utils.admin}).send(function (err, result) {
                if (err) {
                    return callback(err);
                }
                url = result.webSocketServerUrl;
                callback();
            });
        }

        function createNetwork(callback) {
            var params = {
                user: utils.admin,
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

        function createDeviceClass(callback) {
            req.create(path.DEVICE_CLASS)
                .params(utils.deviceClass.getParamsObj(DEVICE, utils.admin, '1'))
                .send(callback);
        }

        function createDevice(callback) {
            req.update(path.get(path.DEVICE, deviceId))
                .params(utils.device.getParamsObj(DEVICE, utils.admin, DEVICE_KEY,
                    {name: NETWORK, key: NETWORK_KEY}, {name: DEVICE, version: '1'}))
                .send(callback);
        }

        function createAccessKey(callback) {
            var args = {
                user: user,
                label: utils.getName('ws-access-key'),
                actions: [
                    'GetDeviceNotification',
                    'CreateDeviceNotification'
                ],
                deviceIds: deviceId,
                //networkIds: networkId // TODO: notification/subscribe fails with this network
                networkIds: void 0
            };
            utils.accessKey.create(utils.admin, args.label, args.actions, args.deviceIds, args.networkIds,
                function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    accessKey = result.key;
                    callback();
                })
        }

        function createInvalidAccessKey(callback) {
            var args = {
                user: user,
                label: utils.getName('ws-invalid-access-key'),
                actions: [ 'GetNetwork' ],
                deviceIds: deviceId,
                networkIds: networkId
            };
            utils.accessKey.create(utils.admin, args.label, args.actions, args.deviceIds, args.networkIds,
                function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    invalidKey = result.key;
                    callback();
                })
        }

        function createConnUsrAuth(callback) {
            clientUsr = new Websocket(url, 'client');
            clientUsr.connect(callback);
        }

        function createConnAccessKeyAuth(callback) {
            clientAK = new Websocket(url, 'client');
            clientAK.connect(callback);
        }

        function createConnInvalidAccessKeyAuth(callback) {
            clientInvalidAK = new Websocket(url, 'client');
            clientInvalidAK.connect(callback);
        }

        function authenticateWithUsr(callback) {
            clientUsr.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    login: user.login,
                    password: user.password
                })
                .send(callback);
        }

        function authenticateWithAccessKey(callback) {
            clientAK.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    accessKey: accessKey
                })
                .send(callback);
        }

        function authenticateWithInvalidAccessKey(callback) {
            clientInvalidAK.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    accessKey: invalidKey
                })
                .send(callback);
        }

        async.series([
            getWsUrl,
            createNetwork,
            createUser,
            createDeviceClass,
            createDevice,
            createAccessKey,
            createInvalidAccessKey,
            createConnUsrAuth,
            createConnAccessKeyAuth,
            createConnInvalidAccessKeyAuth,
            authenticateWithUsr,
            authenticateWithAccessKey,
            authenticateWithInvalidAccessKey
        ], done);
    }

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
                    deviceGuid: deviceId,
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
                    .params({user: utils.admin, id: notificationId})
                    .expect({id: notificationId})
                    .expect(notification)
                    .send(done);
            }
        }

        it('should add new notification, access key auth', function (done) {
            runTest(clientAK, done);
        });

        it('should add new notification, user auth', function (done) {
            runTest(clientUsr, done);
        });

        it('should fail when using wrong access key', function (done) {
            clientInvalidAK.params({
                    action: 'notification/insert',
                    requestId: getRequestId(),
                    deviceGuid: deviceId,
                    notification: notification
                })
                .expectError(401, 'Unauthorized')
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
                    deviceGuids: [deviceId],
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
                        deviceGuid: deviceId,
                        notification: { notification: NOTIFICATION },
                        subscriptionId: subscriptionId
                    });

                req.create(path.NOTIFICATION.get(deviceId))
                    .params({
                        user: user,
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

        it('should subscribe to device notifications, user authorization', function (done) {
            runTest(clientUsr, done);
        });

        it('should subscribe to device notifications, access key authorization', function (done) {
            runTest(clientAK, done);
        });
    });

    describe('#notification/unsubscribe', function () {

        function runTest(client, done) {
            var subscriptionId = null;
            client.params({
                    action: 'notification/subscribe',
                    requestId: getRequestId(),
                    deviceGuids: [deviceId],
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
                    utils.matches(err, {message: 'waitFor() timeout: hasn\'t got message \'notification/insert\''});
                    done();
                });

                req.create(path.NOTIFICATION.get(deviceId))
                    .params({
                        user: utils.admin,
                        data: {notification: NOTIFICATION}
                    })
                    .send();
            }
        }

        it('should unsubscribe from device notifications, user authorization', function (done) {
            runTest(clientUsr, done);
        });

        it('should subscribe to device notifications, access key authorization', function (done) {
            runTest(clientAK, done);
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
                    deviceGuids: [deviceId],
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
                        deviceGuid: deviceId,
                        notification: notification,
                        subscriptionId: subscriptionId
                    });

                req.create(path.NOTIFICATION.get(deviceId))
                    .params({
                        user: user,
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

        it('should notify when notification was inserted, user auth', function (done) {
            runTest(clientUsr, done);
        });

        it('should notify when notification was inserted, access key auth', function (done) {
            runTest(clientAK, done);
        });

        function runTestNoSubscr(client, done) {

            var notification = {
                notification: NOTIFICATION,
                parameters: {a: '3', b: '4'}
            };

            client.waitFor('notification/insert', function (err) {
                assert.strictEqual(!(!err), true, 'Commands should not arrive');
                utils.matches(err, {message: 'waitFor() timeout: hasn\'t got message \'notification/insert\''});
                done();
            });

            req.create(path.NOTIFICATION.get(deviceId))
                .params({
                    user: user,
                    data: notification
                })
                .send();
        }

        it('should not notify when notification was inserted without prior subscription, user auth', function (done) {
            runTestNoSubscr(clientUsr, done);
        });

        it('should not notify when notification was inserted without prior subscription, access key auth', function (done) {
            runTestNoSubscr(clientAK, done);
        });
    });

    after(function (done) {
        clientUsr.close();
        clientAK.close();
        utils.clearResources(done);
    });
});
