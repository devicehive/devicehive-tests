var async = require('async');
var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/ws');
var getRequestId = utils.core.getRequestId;

describe('Round tests for notification', function () {
    this.timeout(90000);
    var url = null;

    var TOTAL_NOTIFS = 10;

    var NOTIFICATION = utils.getName('round-notification');
    var DEVICE = utils.getName('round-notif-device');
    var NETWORK = utils.getName('network-device-cmd');

    var notifications = [];

    var deviceDef = {
        name: DEVICE,
        status: 'Online',
        data: { a: '1', b: '2' }
    };
    var deviceId = utils.getName('round-notif-device-id');
    var networkId = null;
    var deviceTypeId = 1;

    var user = null;
    var jwt = null;

    var deviceConn = null;
    var clientConn = null;

    before(function (done) {

        function initNotifications(callback) {

            for (var i = 0; i < TOTAL_NOTIFS; i++) {
                notifications.push({
                    notification: NOTIFICATION,
                    parameters: { a: (i + 1), b: (i + 2) }
                })
            }

            callback();
        }

        function getWsUrl(callback) {
            req.get(path.INFO).params({ jwt: utils.jwt.admin }).send(function (err, result) {
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
            deviceDef.networkId = networkId;
            req.update(path.get(path.DEVICE, deviceId))
                .params({ jwt: utils.jwt.admin, data: deviceDef })
                .send(function (err) {
                    if (err) {
                        return callback(err);
                    }

                    req.get(path.get(path.DEVICE, deviceId))
                        .params({ jwt: utils.jwt.admin })
                        .send(function (err) {
                            if (err) {
                                return callback(err);
                            }

                            callback();
                        })
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

        function createJWT(callback) {
            var args = {
                actions: [
                    'GetDeviceNotification',
                    'CreateDeviceNotification'
                ],
                networkIds: networkId,
                deviceTypeIds: [1]
            };
            utils.jwt.create(utils.admin.id, args.actions, args.networkIds, args.deviceTypeIds,
                function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    jwt = result.accessToken;
                    callback();
                })
        }

        function createDeviceConn(callback) {
            deviceConn = new Websocket(url);
            deviceConn.connect(callback);
        }

        function authenticateDeviceConn(callback) {
            deviceConn.on({
                action: 'authenticate',
                status: 'success'
            }, callback);

            deviceConn.send({
                action: 'authenticate',
                requestId: getRequestId(),
                token: jwt,
                deviceId: deviceId,
            });
        }

        function createClientConn(callback) {
            clientConn = new Websocket(url);
            clientConn.connect(callback);
        }

        function authenticateClientConn(callback) {
            clientConn.on({
                action: 'authenticate',
                status: 'success'
            }, callback);

            clientConn.send({
                action: 'authenticate',
                requestId: getRequestId(),
                token: jwt
            });
        }

        async.series([
            initNotifications,
            getWsUrl,
            createNetwork,
            createDevice,
            createUser,
            createJWT,
            createDeviceConn,
            authenticateDeviceConn,
            createClientConn,
            authenticateClientConn
        ], done);
    });

    describe('#WS device -> WS client', function () {

        var subscriptionId = null;

        before(function (done) {
            clientConn.on({
                action: 'notification/subscribe',
                status: 'success'
            }, function (err, result) {
                if (err) {
                    return done(err);
                }

                subscriptionId = result.subscriptionId;
                done();
            });
            clientConn.send({
                action: 'notification/subscribe',
                requestId: getRequestId(),
                deviceIds: [deviceId],
                names: [NOTIFICATION]
            });
        });

        function runTest(notification, done) {

            clientConn.on({
                action: 'notification/insert',
                notification: notification
            }, done);

            deviceConn.send({
                action: 'notification/insert',
                requestId: getRequestId(),
                deviceId: deviceId,
                notification: notification
            });
        }

        it('WS device -> WS client', function (done) {
            async.eachSeries(notifications, runTest, done);
        });

        after(function (done) {
            var requestId = getRequestId();
            clientConn.on({
                action: 'notification/unsubscribe',
                requestId: requestId
            }, done);
            clientConn.send({
                action: 'notification/unsubscribe',
                requestId: requestId,
                subscriptionId: subscriptionId
            });
        });
    });

    describe('#WS device -> REST client', function () {

        var $path = null;

        before(function () {
            $path = path.combine(path.NOTIFICATION.get(deviceId), path.POLL);
        });

        function runTest(notification, done) {

            var expectedNotif = utils.core.clone(notification);
            expectedNotif.deviceId = deviceId;

            req.get($path)
                .params({ jwt: jwt })
                .query('names', NOTIFICATION)
                .expect([expectedNotif])
                .send(done);

            setTimeout(function () {
                var requestId = getRequestId();
                deviceConn.on({
                    action: 'notification/insert',
                    status: 'success'
                });
                deviceConn.send({
                    action: 'notification/insert',
                    requestId: requestId,
                    deviceId: deviceId,
                    notification: notification
                });
            }, 500);
        }

        it('WS device -> REST client', function (done) {
            async.eachSeries(notifications, runTest, done);
        });
    });

    describe('#REST device -> WS client', function () {

        var subscriptionId = null;
        var $path = null;

        before(function (done) {

            $path = path.NOTIFICATION.get(deviceId);
            clientConn.on({
                action: 'notification/subscribe',
                status: 'success'
            }, function (err, result) {
                if (err) {
                    return done(err);
                }

                subscriptionId = result.subscriptionId;
                done();
            });

            clientConn.send({
                action: 'notification/subscribe',
                requestId: getRequestId(),
                deviceIds: [deviceId],
                names: [NOTIFICATION]
            });
        });

        function runTest(notification, done) {

            clientConn.on({
                action: 'notification/insert',
                notification: notification
            }, done);

            req.create($path)
                .params({
                    jwt: jwt,
                    data: notification
                })
                .send();
        }

        it('REST device -> WS client', function (done) {
            async.eachSeries(notifications, runTest, done);
        });

        after(function (done) {
            var requestId = getRequestId();

            clientConn.on({
                action: 'notification/unsubscribe',
                requestId: requestId
            }, done);

            clientConn.send({
                action: 'notification/unsubscribe',
                requestId: requestId,
                subscriptionId: subscriptionId
            });
        });
    });

    describe('#REST device -> REST client', function () {

        var deviceAuth = null;
        var clientAuth = null;

        var devicePath = null;
        var clientPath = null;

        before(function (done) {
            devicePath = path.NOTIFICATION.get(deviceId);
            clientPath = path.combine(path.NOTIFICATION.get(deviceId), path.POLL);
            done();
        });

        function runTest(notification, done) {

            var expectedNotif = utils.core.clone(notification);
            expectedNotif.deviceTypeId = deviceTypeId;
            expectedNotif.deviceId = deviceId;
            expectedNotif.networkId = networkId;

            var deviceParams = utils.core.clone(deviceAuth);
            var clientParams = utils.core.clone(clientAuth);

            req.get(clientPath)
                .params(clientParams)
                .query('names', NOTIFICATION)
                .send(function (err, result) {
                    expectedNotif.id = result[0].id;
                    expectedNotif.timestamp = result[0].timestamp;
                    assert.deepEqual(result, [expectedNotif], "Not expected notification");
                    done();
                });


            setTimeout(function () {
                deviceParams.data = notification;
                req.create(devicePath)
                    .params(deviceParams)
                    .send();
            }, 100);


        }

        it('REST device -> REST client', function (done) {
            deviceAuth = { jwt: utils.jwt.admin };
            clientAuth = { jwt: jwt };
            async.eachSeries(notifications, runTest, done);
        });
    });

    after(function (done) {
        clientConn.close();
        deviceConn.close();
        utils.clearDataJWT(done);
    });
});
