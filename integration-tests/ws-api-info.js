var utils = require('./common/utils');
var path = require('./common/path');
var req = require('./common/request');
var Websocket = require('./common/websocket');
var getRequestId = utils.core.getRequestId;

describe('WebSocket API Server Info', function () {
    var url = null;

    before(function (done) {
        req.get(path.INFO).params({token: utils.jwt.admin}).send(function (err, result) {
            if (err) {
                return done(err);
            }
            url = result.webSocketServerUrl;
            done();
        });
    });

    describe('#server/json-error', function () {

        it('should get malformed json error when request message is not a json', function (done) {

            function waitForSocketConnection(client, callback){
                setTimeout(
                    function () {
                        if (client.readyState === 1) {
                            if(callback != null){
                                callback();
                            }
                            return;
                        } else {
                            waitForSocketConnection(client, callback);
                        }
                    }, 5);
            }

            var client = new global.WebSocket(url);
            var assert = require('assert');
            var malformedJson = 'not a Json';

            waitForSocketConnection(client, function () {
                client.send(malformedJson);
                console.log('-> "%s"', malformedJson);
            });

            client.onmessage = function (evt) {
                var received_msg = evt.data;
                console.log('<- %s', received_msg);
                var responseJSON = JSON.parse(received_msg);
                assert.equal(responseJSON.code, 400);
                assert.equal(responseJSON.error, 'Malformed Json received.');
                done();
            };

        });

        it('should get malformed json error when request message is a single character', function (done) {

            function waitForSocketConnection(client, callback){
                setTimeout(
                    function () {
                        if (client.readyState === 1) {
                            if(callback != null){
                                callback();
                            }
                            return;
                        } else {
                            waitForSocketConnection(client, callback);
                        }
                    }, 5);
            }

            var client = new global.WebSocket(url);
            var assert = require('assert');
            var malformedJson = '1';

            waitForSocketConnection(client, function () {
                client.send(malformedJson);
                console.log('-> "%s"', malformedJson);
            });

            client.onmessage = function (evt) {
                var received_msg = evt.data;
                console.log('<- %s', received_msg);
                var responseJSON = JSON.parse(received_msg);
                assert.equal(responseJSON.code, 400);
                assert.equal(responseJSON.error, 'Malformed Json received.');
                done();
            };

        });

        it('should get malformed json error when request message is not a proper json', function (done) {

            function waitForSocketConnection(client, callback){
                setTimeout(
                    function () {
                        if (client.readyState === 1) {
                            if(callback != null){
                                callback();
                            }
                            return;
                        } else {
                            waitForSocketConnection(client, callback);
                        }
                    }, 5);
            }

            var client = new global.WebSocket(url);
            var assert = require('assert');
            var malformedJson = '{\n"text": \n}';

            waitForSocketConnection(client, function () {
                client.send(malformedJson);
                console.log('-> "%s"', malformedJson);
            });

            client.onmessage = function (evt) {
                var received_msg = evt.data;
                console.log('<- %s', received_msg);
                var responseJSON = JSON.parse(received_msg);
                assert.equal(responseJSON.code, 400);
                assert.equal(responseJSON.error, 'Malformed Json received.');
                done();
            };

        });

    });

    describe('#server/info', function () {

        it('should get server info, no auth', function (done) {
            var client = new Websocket(url);
            client.connect(function (err) {
                if (err) {
                    return done(err);
                }

                var requestId = getRequestId();
                client.params({
                    action: 'server/info',
                    requestId: requestId
                })
                    .expect({
                        action: 'server/info',
                        status: 'success',
                        requestId: requestId
                    })
                    .assert(function (result) {
                        utils.hasPropsWithValues(result.info, ['apiVersion', 'serverTimestamp', 'restServerUrl']);
                    })
                    .send(done);
            });
        });
    });

    describe('#server/cacheInfo', function () {

        it('should get server info, no auth', function (done) {
            var client = new Websocket(url);
            client.connect(function (err) {
                if (err) {
                    return done(err);
                }

                var requestId = getRequestId();
                client.params({
                    action: 'server/cacheInfo',
                    requestId: requestId
                })
                    .expect({
                        action: 'server/cacheInfo',
                        status: 'success',
                        requestId: requestId
                    })
                    .assert(function (result) {
                        utils.hasPropsWithValues(result.cacheInfo, ['serverTimestamp', 'cacheStats']);
                    })
                    .send(done);
            });
        });
    });

    describe('#cluster/info', function () {

        it('should get cluster info, no auth', function (done) {
            var client = new Websocket(url);
            client.connect(function (err) {
                if (err) {
                    return done(err);
                }

                var requestId = getRequestId();
                client.params({
                    action: 'cluster/info',
                    requestId: requestId
                })
                    .expect({
                        action: 'cluster/info',
                        status: 'success',
                        requestId: requestId
                    })
                    .assert(function (result) {
                        utils.hasPropsWithValues(result.clusterInfo, ['bootstrap.servers', 'zookeeper.connect']);
                    })
                    .send(done);
            });
        });
    });
});
