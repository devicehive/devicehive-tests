var async = require('async');
var assert = require('assert');
var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/ws');
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

    before(function (done) {

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
                    networkId, { name: DEVICE, version: '1' }))
                .send(callback);
        }

        function createToken(callback) {
            var args = {
                actions: [
                    'GetDeviceCommand',
                    'GetDeviceNotification'
                ],
                deviceIds: ['*'],
                networkIds: ['*'],
                deviceTypeIds: ['*']
            };
            utils.jwt.create(user.id, args.actions, args.networkIds, args.deviceTypeIds, function (err, result) {
                if (err) {
                    return callback(err);
                }
                token = result.accessToken;
                callback()
            })
        }

        function createInvalidToken(callback) {
            var args = {
                actions: ['GetNetwork'],
                deviceIds: [deviceId],
                networkIds: [networkId],
                deviceTypeIds: ['*']
            };
            utils.jwt.create(user.id, args.actions, args.networkIds, args.deviceTypeIds, function (err, result) {
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
            clientToken.on({
                action: 'authenticate',
                status: 'success'
            }, callback);

            clientToken.send({
                action: 'authenticate',
                requestId: getRequestId(),
                token: token
            });
        }

        function authenticateWithInvalidToken(callback) {
            clientInvalidToken.on({
                action: 'authenticate',
                status: 'success'
            }, callback);

            clientInvalidToken.send({
                action: 'authenticate',
                requestId: getRequestId(),
                token: invalidToken
            });
        }

        function authenticateConn(callback) {
            device.on({
                action: 'authenticate',
                status: 'success'
            }, callback);

            device.send({
                action: 'authenticate',
                requestId: getRequestId(),
                token: token
            });
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

            device.on({
                action: 'subscription/list',
                status: 'success',
                requestId: requestId
            }, (err, data) => {
                assert.deepEqual(data.subscriptions, {}, "Subscriptions list should be empty");
                done();
            });

            device.send({
                action: 'subscription/list',
                requestId: requestId
            });
        });

        it('should return subscription info for command/subscribe', function (done) {
            var requestId = getRequestId();

            device.on({
                action: 'command/subscribe',
                requestId: requestId,
                status: 'success'
            }, onSubscribed);

            device.send({
                action: 'command/subscribe',
                deviceIds: [deviceId],
                requestId: requestId
            });

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                var subscriptionId = result.subscriptionId;

                device.on({
                    action: 'subscription/list',
                    status: 'success',
                    requestId: requestId
                }, (err, data) => {
                    assert.equal(data.subscriptions[0].subscriptionId, subscriptionId);
                    assert.equal(data.subscriptions[0].type, "command");
                    cleanUp();
                });

                device.send({
                    action: 'subscription/list',
                    requestId: requestId
                });

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    device.on({
                        action: 'command/unsubscribe',
                        status: 'success'
                    }, done);

                    device.send({
                        action: 'command/unsubscribe',
                        requestId: requestId
                    });
                }
            }
        });

        it('should return subscription info for notification/subscribe', function (done) {
            var requestId = getRequestId();

            device.on({
                action: 'notification/subscribe',
                requestId: requestId,
                status: 'success'
            }, onSubscribed);

            device.send({
                action: 'notification/subscribe',
                deviceIds: [deviceId],
                requestId: requestId
            });

            function onSubscribed(err, result) {
                if (err) {
                    return done(err);
                }

                var subscriptionId = result.subscriptionId;

                device.on({
                    action: 'subscription/list',
                    status: 'success',
                    requestId: requestId
                }, (err, data) => {
                    assert.equal(data.subscriptions[0].subscriptionId, subscriptionId);
                    assert.equal(data.subscriptions[0].type, "notification");
                    cleanUp();
                });

                device.send({
                    action: 'subscription/list',
                    requestId: requestId
                });

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    device.on({
                        action: 'notification/unsubscribe',
                        status: 'success'
                    }, done);

                    device.send({
                        action: 'notification/unsubscribe',
                        requestId: requestId
                    });
                }
            }
        });

        it('should return empty notification list for command/subscribe', function (done) {
            var requestId = getRequestId();


            device.on({
                action: 'command/subscribe',
                requestId: requestId,
                status: 'success'
            }, onSubscribed);

            device.send({
                action: 'command/subscribe',
                deviceIds: [deviceId],
                requestId: requestId
            });

            function onSubscribed(err) {
                if (err) {
                    return done(err);
                }

                device.on({
                    action: 'subscription/list',
                    status: 'success',
                    requestId: requestId
                }, (err, data) => {
                    assert.deepEqual(data.subscriptions, [], "Subscriptions list should be empty");
                    cleanUp();
                })

                device.send({
                    action: 'subscription/list',
                    type: "notification",
                    requestId: requestId
                })

                function cleanUp(err) {
                    if (err) {
                        return done(err);
                    }

                    device.on({
                        action: 'command/unsubscribe',
                        status: 'success'
                    }, done);

                    device.send({
                        action: 'command/unsubscribe',
                        requestId: requestId
                    });
                }
            }
        });

        it('should return 403 using token without proper permissions', function (done) {
            var requestId = getRequestId();

            clientInvalidToken.on({
                code: 403,
                error: 'Access is denied'
            }, done);
            
            clientInvalidToken.send({
                action: 'subscription/list',
                requestId: requestId
            });
        });
    });

    after(function (done) {
        device.close();
        clientToken.close();
        clientInvalidToken.close();
        utils.clearDataJWT(done);
    });
});