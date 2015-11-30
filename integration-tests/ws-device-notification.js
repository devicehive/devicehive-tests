var async = require('async');
var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API Device Notification', function () {
    this.timeout(30000);
    var url = null;

    var DEVICE = utils.getName('ws-device-notif');
    var NETWORK = utils.getName('ws-network-notif');
    var NOTIFICATION = utils.getName('ws-notification');

    var deviceId = utils.getName('ws-device-notif-id');
    var accessKey = null;
    var device = null;

    before(function (done) {

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
                .params(utils.device.getParamsObj(DEVICE, utils.admin,
                    {name: NETWORK}, {name: DEVICE, version: '1'}))
                .send(callback);
        }

        function createAccessKey(callback) {
            var args = {
                label: utils.getName('ws-access-key'),
                actions: [
                    'CreateDeviceNotification',
                    'GetDeviceNotification'
                ]
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

        function createConn(callback) {
            device = new Websocket(url, 'device');
            device.connect(callback);
        }

        function authenticateConn(callback) {
            device.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    accessKey: accessKey
                })
                .send(callback);
        }

        async.series([
            getWsUrl,
            createDevice,
            createAccessKey,
            createConn,
            authenticateConn
        ], done);
    });

    describe('#notification/insert', function () {

        var notification = {
            notification: NOTIFICATION,
            parameters: {a: '1', b: '2'}
        };

        it('should add new notification, access key auth', function (done) {
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
                    .params({user: utils.admin, id: notificationId})
                    .expect({id: notificationId})
                    .expect(notification)
                    .send(done);
            }
        });

        it('should authenticate fail when using wrong access key', function (done) {
            device.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    accessKey: 'invalid-device-key'
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

    after(function (done) {
        device.close();
        utils.clearData(done);
    });
});
