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

    var INTERVAL = 1000;
    var TOTAL_NOTIFS = 20;

    var NOTIFICATION = utils.getName('round-notification');
    var DEVICE = utils.getName('round-notif-device');
    var DEVICE_KEY = utils.getName('round-notif-device-key');

    var notifications = [];

    var deviceDef = {
        name: DEVICE,
        key: DEVICE_KEY,
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

        function createAccessKey(callback) {
            var args = {
                label: utils.getName('ws-access-key'),
                actions: [
                    'GetDeviceNotification',
                    'CreateDeviceNotification',
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
                    deviceKey: DEVICE_KEY
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

        it('should transfer device notifications to clients', function (done) {
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

    after(function (done) {
        clientConn.close();
        deviceConn.close();
        utils.clearData(done);
    });
});
