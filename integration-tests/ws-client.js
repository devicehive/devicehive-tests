var async = require('async');
var assert = require('assert');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API Client', function () {
    var url = null;

    var DEVICE = utils.getName('ws-client-device');
    var DEVICE_KEY = utils.getName('ws-client-device-key');
    var NETWORK = utils.getName('ws-client-network');
    var NETWORK_KEY = utils.getName('ws-client-network-key');

    var COMMAND = utils.getName('ws-command');

    var deviceId = utils.getName('ws-client-device-id');
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
                    'GetDeviceCommand',
                    'CreateDeviceNotification',
                    'CreateDeviceCommand',
                    'UpdateDeviceCommand'
                ],
                deviceIds: deviceId,
                networkIds: networkId
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

    describe('#Authenticate', function () {

        var clntUsr = null;
        var clntAK = null;

        it('should authenticate using login and password', function (done) {
            var requestId = getRequestId();

            function createConnection(callback) {
                clntUsr = new Websocket(url, 'client');
                clntUsr.connect(callback);
            }

            function runTest(callback) {
                clntUsr.params({
                        action: 'authenticate',
                        requestId: requestId,
                        login:  user.login,
                        password: user.password
                    })
                    .expect({
                        action: 'authenticate',
                        status: 'success',
                        requestId: requestId
                    })
                    .send(callback);
            }

            async.series([
                createConnection,
                runTest
            ], done);
        });

        it('should authenticate using access key', function (done) {
            var requestId = getRequestId();

            function createConnection(callback) {
                clntAK = new Websocket(url, 'client');
                clntAK.connect(callback);
            }

            function runTest(callback) {
                clntAK.params({
                        action: 'authenticate',
                        requestId: requestId,
                        accessKey:  accessKey
                    })
                    .expect({
                        action: 'authenticate',
                        status: 'success',
                        requestId: requestId
                    })
                    .send(callback);
            }

            async.series([
                createConnection,
                runTest
            ], done);
        });

        after(function () {
            if (clntUsr) {
                clntUsr.close();
            }
            if (clntAK) {
                clntAK.close();
            }
        });
    });

    describe('#Command', function () {

        describe('#command/insert', function () {

            var command = {
                command: COMMAND,
                status: 'in progress'
            };

            function runTest(client, done) {
                var requestId = getRequestId();
                client.params({
                        action: 'command/insert',
                        requestId: requestId,
                        deviceGuid: deviceId,
                        command: command
                    })
                    .expect({
                        action: 'command/insert',
                        status: 'success',
                        requestId: requestId
                    })
                    .assert(function (result) {
                        utils.hasPropsWithValues(result.command, ['id', 'timestamp', 'userId']);
                    })
                    .send(onInsert);

                function onInsert(err, result) {
                    if (err) {
                        return done(err);
                    }

                    var commandId = result.command.id;
                    req.get(path.COMMAND.get(deviceId))
                        .params({user: utils.admin, id: commandId})
                        .expect({id: commandId})
                        .expect(command)
                        .send(done);
                }
            }

            it('should add new command, access key auth', function (done) {
                runTest(clientAK, done);
            });

            it('should add new command, user auth', function (done) {
                runTest(clientUsr, done);
            });

            it('should fail when using wrong access key', function (done) {
                clientInvalidAK.params({
                        action: 'command/insert',
                        requestId: getRequestId,
                        deviceGuid: deviceId,
                        command: command
                    })
                    .expectError(401, 'Unauthorized')
                    .send(done);
            });
        });

        describe('#command/subscribe', function () {

            function runTest(client, done) {
                var requestId = getRequestId();
                var subscriptionId = null;
                client.params({
                        action: 'command/subscribe',
                        requestId: requestId,
                        deviceGuids: [deviceId],
                        names: [COMMAND]
                    })
                    .expect({
                        action: 'command/subscribe',
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
                    client.waitFor('command/insert', cleanUp)
                        .expect({
                            action: 'command/insert',
                            deviceGuid: deviceId,
                            command: { command: COMMAND },
                            subscriptionId: subscriptionId
                        });

                    req.create(path.COMMAND.get(deviceId))
                        .params({
                            user: utils.admin,
                            data: {command: COMMAND}
                        })
                        .send();

                    function cleanUp(err) {
                        if (err) {
                            return done(err);
                        }

                        client.params({
                                action: 'command/unsubscribe',
                                requestId: getRequestId(),
                                subscriptionId: subscriptionId
                            })
                            .send(done);
                    }
                }
            }

            it('should subscribe to device commands, user authorization', function (done) {
                runTest(clientUsr, done);
            });

            it.only('should subscribe to device commands, access key authorization', function (done) {
                runTest(clientAK, done);
            });
        });
    });

    describe('#', function () {

        //it.only('should ', function (done) {
        //    client.params()
        //        .expect({})
        //        .assert(function (result) {
        //        })
        //        .expectTrue(function (result) {
        //            return true;
        //        })
        //        .expectError()
        //        .send(done);
        //
        //    req.get(path.current)
        //        .params()
        //        .expectError()
        //        .expect()
        //        .expectTrue(function (result) {
        //            return true;
        //        })
        //        .send(done);
        //});
    });

    after(function (done) {
        clientUsr.close();
        clientAK.close();
        utils.clearResources(done);
    });
});
