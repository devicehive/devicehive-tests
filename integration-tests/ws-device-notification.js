var async = require('async');
var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API Device Notification', function () {
    this.timeout(90000);
    var url = null;

    var DEVICE = utils.getName('ws-device-notif');
    var NETWORK = utils.getName('ws-network-notif');
    var NOTIFICATION = utils.getName('ws-notification');

    var networkId = null;
    var deviceId = utils.getName('ws-device-notif-id');
    var token = null;
    var device = null;

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

        function createDevice(callback) {
            req.update(path.get(path.DEVICE, deviceId))
                .params(utils.device.getParamsObj(DEVICE, utils.jwt.admin,
                	networkId, {name: DEVICE, version: '1'}))
                .send(callback);
        }

        function createToken(callback) {
            var args = {
                actions: [
                    'CreateDeviceNotification',
                    'GetDeviceNotification'
                ],
                deviceIds: void 0,
                networkIds: void 0
            };
            utils.jwt.create(utils.admin.id, args.actions, args.networkIds,  args.deviceIds,
                function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    token = result.accessToken;
                    callback();
                })
        }

        function createConn(callback) {
            device = new Websocket(url, 'device');
            device.connect(callback);
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
            createDevice,
            createToken,
            createConn,
            authenticateConn
        ], done);
    });

    describe('#notification/insert', function () {

        var notification = {
            notification: NOTIFICATION,
            parameters: {a: '1', b: '2'}
        };

        it('should add new notification, jwt auth', function (done) {
            var requestId = getRequestId();

            device.params({
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
                    .params({jwt: utils.jwt.admin, id: notificationId})
                    .expect({id: notificationId})
                    .expect(notification)
                    .send(done);
            }
        });

        it('should authenticate fail when using wrong token', function (done) {
            device.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    token: 'invalid-device-token'
                })
                .expectError(401, 'Invalid credentials')
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

        it('should fail when using wrong deviceGuid', function (done) {
            device.params({
                    action: 'notification/insert',
                    requestId: getRequestId(),
                    deviceGuid: 'invalid-device-id',
                    notification: notification
                })
                .expectError(403, 'Device guid is wrong or empty')
                .send(done);
        });
    });

    describe('#notification/subscribe', function () {
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
                deviceGuids: [deviceId],
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
                        deviceGuid: deviceId,
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

    after(function (done) {
        device.close();
        utils.clearDataJWT(done);
    });
});
