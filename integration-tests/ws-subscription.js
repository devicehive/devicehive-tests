var async = require('async');
var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API Subscription', function () {
    this.timeout(90000);
    var url = null;

    var DEVICE = utils.getName('ws-cmd-device');
    var NETWORK = utils.getName('ws-cmd-network');

    var deviceId = utils.getName('ws-cmd-device-id');
    var user = null;
    var token = null;
    var invalidToken = null;
    var device = null;
    var networkId = null;

    var clientToken = null;
    var clientInvalidToken = null;

    beforeEach(function(done) {
        setTimeout(done, 1000);
    });

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
                data: { name: NETWORK }
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
            utils.createUser2(1, [networkId], function (err, result) {
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
                    'GetDeviceCommand',
                    'GetDeviceNotification'
                ],
                deviceIds: ['*'],
                networkIds: ['*']
            };
            utils.jwt.create(user.id, args.actions, args.networkIds, args.deviceIds, function (err, result) {
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
                deviceIds: [deviceId],
                networkIds: [networkId]
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
            createToken,
            createInvalidToken,
            createConnTokenAuth,
            createConnInvalidTokenAuth,
            createConn,
            authenticateWithToken,
            authenticateWithInvalidToken,
            authenticateConn
        ], done);
    });

    describe('#subscription/list', function () {

        it('should return empty list for session without subscriptions', function (done) {
            var requestId = getRequestId();

            device.params({
                action: 'subscription/list',
                requestId: requestId
            })
                .expect({
                    action: 'subscription/list',
                    status: 'success',
                    requestId: requestId
                })
                .assert(function (result) {
                    assert.deepEqual(result.subscriptions, {}, "Subscriptions list should be empty");
                })
                .send(done);
        });

        it('should return subscription info for command/subscribe', function (done) {
            var requestId = getRequestId();

            device.params({
                action: 'command/subscribe',
                deviceIds: [deviceId],
                requestId: requestId
            })
                .expect({
                    action: 'command/subscribe',
                    requestId: requestId,
                    status: 'success'
                })
                .send(onSubscribed);

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                var subscriptionId = result.subscriptionId;
                device.params({
                    action: 'subscription/list',
                    requestId: requestId
                })
                    .expect({
                        action: 'subscription/list',
                        status: 'success',
                        requestId: requestId
                    })
                    .assert(function (result) {
                        assert.deepEqual(result.subscriptions[subscriptionId].deviceIds, [deviceId]);
                        assert.equal(result.subscriptions[subscriptionId].eventName, "COMMAND_EVENT");
                    })
                    .send(cleanUp);

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    device.params({
                        action: 'command/unsubscribe',
                        requestId: requestId
                    })
                        .send(done);
                }
            }
        });

        it('should return subscription info for notification/subscribe', function (done) {
            var requestId = getRequestId();

            device.params({
                action: 'notification/subscribe',
                deviceIds: [deviceId],
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

                var subscriptionId = result.subscriptionId;
                device.params({
                    action: 'subscription/list',
                    requestId: requestId
                })
                    .expect({
                        action: 'subscription/list',
                        status: 'success',
                        requestId: requestId
                    })
                    .assert(function (result) {
                        assert.deepEqual(result.subscriptions[subscriptionId].deviceIds, [deviceId]);
                        assert.equal(result.subscriptions[subscriptionId].eventName, "NOTIFICATION_EVENT");
                    })
                    .send(cleanUp);

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    device.params({
                        action: 'notification/unsubscribe',
                        requestId: requestId
                    })
                        .send(done);
                }
            }
        });

        it('should return empty notification list for command/subscribe', function (done) {
            var requestId = getRequestId();

            device.params({
                action: 'command/subscribe',
                deviceIds: [deviceId],
                requestId: requestId
            })
                .expect({
                    action: 'command/subscribe',
                    requestId: requestId,
                    status: 'success'
                })
                .send(onSubscribed);

            function onSubscribed(err) {
                if (err) {
                    return done(err);
                }

                device.params({
                    action: 'subscription/list',
                    type: "notification",
                    requestId: requestId
                })
                    .expect({
                        action: 'subscription/list',
                        status: 'success',
                        requestId: requestId
                    })
                    .assert(function (result) {
                        assert.deepEqual(result.subscriptions, {}, "Subscriptions list should be empty");
                    })
                    .send(cleanUp);

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    device.params({
                        action: 'command/unsubscribe',
                        requestId: requestId
                    })
                        .send(done);
                }
            }
        });

        it('should return 403 using token without proper permissions', function (done) {
            var requestId = getRequestId();

            clientInvalidToken.params({
                action: 'subscription/list',
                requestId: requestId
            })
                .expectError(403, 'Access is denied')
                .send(done);

        });
    });

    after(function (done) {
        device.close();
        clientToken.close();
        clientInvalidToken.close();
        utils.clearDataJWT(done);
    });
});