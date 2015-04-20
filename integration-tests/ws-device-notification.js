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
    var DEVICE_KEY = utils.getName('ws-device-notif-key');
    var NETWORK = utils.getName('ws-network-notif');
    var NOTIFICATION = utils.getName('ws-notification');

    var deviceId = utils.getName('ws-device-notif-id');
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
                .params(utils.device.getParamsObj(DEVICE, utils.admin, DEVICE_KEY,
                    {name: NETWORK}, {name: DEVICE, version: '1'}))
                .send(callback);
        }

        function createConn(callback) {
            device = new Websocket(url, 'device');
            device.connect(callback);
        }

        function authenticateConn(callback) {
            device.params({
                    action: 'authenticate',
                    requestId: getRequestId(),
                    deviceId:  deviceId,
                    deviceKey: DEVICE_KEY
                })
                .send(callback);
        }

        async.series([
            getWsUrl,
            createDevice,
            createConn,
            authenticateConn
        ], done);
    });

    describe('#notification/insert', function () {

        var notification = {
            notification: NOTIFICATION,
            parameters: {a: '1', b: '2'}
        };

        it('should add new notification, device auth', function (done) {
            var requestId = getRequestId();

            device.params({
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
                    utils.hasPropsWithValues(result.notification, ['id', 'notification', 'deviceGuid', 'timestamp']);
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

        it.only('should fail when using wrong access key', function (done) {
            device.params({
                    action: 'notification/insert',
                    requestId: getRequestId(),
                    //deviceId: 'invalid-device-id', // TODO: test fails since 'deviceId' param is used. 'deviceGuid' won't work as well
                    deviceGuid: 'invalid-device-id',
                    deviceKey: 'invalid-device-key',
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
