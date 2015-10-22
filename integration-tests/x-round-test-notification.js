var async = require('async');
var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('Round tests for notification', function () {
    this.timeout(60000);
    var url = null;

    //var INTERVAL = 500;
    //var TOTAL_NOTIFS = 20;

    var INTERVAL = 1000;
    var TOTAL_NOTIFS = 10;

    var NOTIFICATION = utils.getName('round-notification');
    var DEVICE = utils.getName('round-notif-device');

    var notifications = [];

    var deviceDef = {
        name: DEVICE,
        status: 'Online',
        data: {a: '1', b: '2'},
        network: {
            name: utils.getName('round-notif-network'),
            description: 'lorem ipsum dolor sit amet'
        },
        deviceClass: {
            name: DEVICE,
            version: '1',
            isPermanent: true,
            offlineTimeout: 1234,
            data: {c: '3', d: '4'},
            equipment: [{
                name: "_integr-test-eq",
                code: "321",
                type: "_integr-test-type",
                data: {e: '5', f: '6'}
            }]
        }
    };
    var deviceId = utils.getName('round-notif-device-id');
    var networkId = null;

    var user = null;
    var accessKey = null;

    var deviceConn = null;
    var clientConn = null;

    before(function (done) {

        function initNotifications(callback) {

            for (var i = 0; i < TOTAL_NOTIFS; i++) {
                notifications.push({
                    notification: NOTIFICATION,
                    parameters: {a: (i + 1), b: (i + 2)}
                })
            }

            callback();
        }

        function getWsUrl(callback) {
            req.get(path.INFO).params({user: utils.admin}).send(function (err, result) {
                if (err) {
                    return callback(err);
                }
                url = result.webSocketServerUrl;
                callback();
            });
        }

        function createDevice(callback) {
            req.update(path.get(path.DEVICE, deviceId))
                .params({user: utils.admin, data: deviceDef})
                .send(function (err) {
                    if (err) {
                        return callback(err);
                    }

                    req.get(path.get(path.DEVICE, deviceId))
                        .params({user: utils.admin})
                        .send(function (err, result) {
                            if (err) {
                                return callback(err);
                            }

                            networkId = result.network.id;
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

        function createAccessKey(callback) {
            var args = {
                label: utils.getName('ws-access-key'),
                actions: [
                    'GetDeviceNotification',
                    'CreateDeviceNotification'
                ],
                networkIds: networkId
            };
            utils.accessKey.create(utils.admin, args.label, args.actions, void 0, args.networkIds,
                function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    accessKey = result.key;
                    callback();
                })
        }

        function createDeviceConn(callback) {
            deviceConn = new Websocket(url, 'device');
            deviceConn.connect(callback);
        }

        function authenticateDeviceConn(callback) {
            deviceConn.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    deviceId: deviceId,
                    accessKey: accessKey
                })
                .send(callback);
        }

        function createClientConn(callback) {
            clientConn = new Websocket(url, 'client');
            clientConn.connect(callback);
        }

        function authenticateClientConn(callback) {
            clientConn.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    accessKey: accessKey
                })
                .send(callback);
        }

        async.series([
            initNotifications,
            getWsUrl,
            createDevice,
            createUser,
            createAccessKey,
            createDeviceConn,
            authenticateDeviceConn,
            createClientConn,
            authenticateClientConn
        ], done);
    });

    describe('#WS device -> WS client', function () {

        var subscriptionId = null;

        before(function (done) {
            clientConn.params({
                    action: 'notification/subscribe',
                    requestId: getRequestId(),
                    deviceGuids: [deviceId],
                    names: [NOTIFICATION]
                })
                .send(function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    subscriptionId = result.subscriptionId;
                    done();
                })
        });

        function runTestDelayed(notification, done) {
            setTimeout(function () {
                runTest(notification, done);
            }, INTERVAL);
        }

        function runTest(notification, done) {

            clientConn.waitFor('notification/insert', done)
                .expect({
                    action: 'notification/insert',
                    notification: notification
                });

            deviceConn.params({
                    action: 'notification/insert',
                    requestId: getRequestId(),
                    deviceId: deviceId,
                    notification: notification
                })
                .send();
        }

        it('WS device, device auth -> WS client, access key auth', function (done) {
            async.eachSeries(notifications, runTestDelayed, done);
        });

        after(function (done) {
            clientConn.params({
                    action: 'notification/unsubscribe',
                    requestId: getRequestId(),
                    subscriptionId: subscriptionId
                })
                .send(done);
        });
    });

    describe('#WS device -> REST client', function () {

        var $path = null;

        before(function () {
            $path = path.combine(path.NOTIFICATION.get(deviceId), path.POLL);
        });

        function runTestDelayed(notification, done) {
            setTimeout(function () {
                runTest(notification, done);
            }, INTERVAL);
        }

        function runTest(notification, done) {

            var expectedNotif = utils.core.clone(notification);
            expectedNotif.deviceGuid = deviceId;

            req.get($path)
                .params({user: user})
                .query('names', NOTIFICATION)
                .expect([expectedNotif])
                .send(done);

            setTimeout(function () {
                deviceConn.params({
                        action: 'notification/insert',
                        requestId: getRequestId(),
                        deviceId: deviceId,
                        notification: notification
                    })
                    .send();
            }, 500);
        }

        it('WS device, device auth -> REST client, user auth', function (done) {
            async.eachSeries(notifications, runTestDelayed, done);
        });
    });

    describe('#REST device -> WS client', function () {

        var subscriptionId = null;
        var $path = null;

        before(function (done) {

            $path = path.NOTIFICATION.get(deviceId);

            clientConn.params({
                    action: 'notification/subscribe',
                    requestId: getRequestId(),
                    deviceGuids: [deviceId],
                    names: [NOTIFICATION]
                })
                .send(function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    subscriptionId = result.subscriptionId;
                    done();
                })
        });

        function runTestDelayed(notification, done) {
            setTimeout(function () {
                runTest(notification, done);
            }, INTERVAL);
        }

        function runTest(notification, done) {

            clientConn.waitFor('notification/insert', 4000, done)
                .expect({
                    action: 'notification/insert',
                    notification: notification
                });

            req.create($path)
                .params({
                    accessKey: accessKey,
                    data: notification
                })
                .send();
        }

        it('REST device, device auth -> WS client, access key auth', function (done) {
            async.eachSeries(notifications, runTestDelayed, done);
        });

        after(function (done) {
            clientConn.params({
                    action: 'notification/unsubscribe',
                    requestId: getRequestId(),
                    subscriptionId: subscriptionId
                })
                .send(done);
        });
    });

    describe('#REST device -> REST client', function () {

        var deviceAuth = null;
        var clientAuth = null;

        var devicePath = null;
        var clientPath = null;

        before(function () {
            devicePath = path.NOTIFICATION.get(deviceId);
            clientPath = path.combine(path.NOTIFICATION.get(deviceId), path.POLL);
        });

        function runTestDelayed(notification, done) {
            setTimeout(function () {
                runTest(notification, done);
            }, INTERVAL);
        }

        function runTest(notification, done) {

            var expectedNotif = utils.core.clone(notification);
            expectedNotif.deviceGuid = deviceId;

            req.get(clientPath)
                .params(utils.core.clone(clientAuth))
                .query('names', NOTIFICATION)
                .expect([expectedNotif])
                .send(done);

            setTimeout(function () {
                var params = utils.core.clone(deviceAuth);
                params.data = notification;
                req.create(devicePath)
                    .params(params)
                    .send();
            }, 500);
        }

        it('REST device, access key auth -> REST client, access key auth', function (done) {
            deviceAuth = {accessKey: accessKey};
            clientAuth = {accessKey: accessKey};
            async.eachSeries(notifications, runTestDelayed, done);
        });

        it('REST device, device auth -> REST client, user auth', function (done) {
            deviceAuth = {accessKey:accessKey};
            clientAuth = {user: user};
            async.eachSeries(notifications, runTestDelayed, done);
        });

        it('REST device, access key auth -> REST client, user auth', function (done) {
            deviceAuth = {accessKey: accessKey};
            clientAuth = {user: user};
            async.eachSeries(notifications, runTestDelayed, done);
        });
    });

    after(function (done) {
        clientConn.close();
        deviceConn.close();
        utils.clearData(done);
    });
});
