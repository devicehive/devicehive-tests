global.WebSocket = require('ws');
var assert = require('assert');
var utils = require('./utils');

var connId = 1;

function Websocket(url) {
    this.id = connId++;
    this.name = '#' + this.id;
    this.socket = new WebSocket(url);
    this.context = null;
    this.waitTimeoutId = null;
}

Websocket.prototype = {

    connect: function (done) {
        var self = this;
        var $done = done;

        this.socket.onopen = function () {
            return $done() || ($done = null);
        };
        this.socket.onclose = function (event) {
            if (!event.wasClean) {
                console.log('connection lost');
            }
        };
        this.socket.onmessage = function (message) {
            self.onMessage(message);
        };
        this.socket.onerror = function (err) {
            if ($done) {
                return $done(err) || ($done = null);
            }

            console.log(JSON.stringify(err));
        };
        this.socket.onclose = function () {
            console.log('%s closed connection', self.name);
        };
    },

    params: function (params) {
        this.context = {
            params: params,
            assertions: [],
            expectations: [],
            trueExpectations: [],
            falseExpectations: []
        };
        return this;
    },

    assert: function (expected) {
        this.context.assertions.push(expected);
        return this;
    },

    expect: function (expected) {
        this.context.expectations.push(expected);
        return this;
    },

    expectTrue: function (expected) {
        this.context.trueExpectations.push(expected);
        return this;
    },

    expectFalse: function (expected) {
        this.context.falseExpectations.push(expected);
        return this;
    },

    expectError: function (code, error) {
        this.context.expectError = {
            code: code
        };
        if (error) {
            this.context.expectError.error = error;
        }
        return this;
    },

    send: function (done) {
        done || (done = utils.emptyCb);

        var self = this;
        this.context.done = done;
        var params = JSON.stringify(this.context.params);
        console.log('-> %s', params);
        this.socket.send(params);

        this.waitTimeoutId = setTimeout(function () {
            if (self.context.handled) {
                return;
            }

            self.context.handled = true;
            done(new Error('send() timeout: hasn\'t got message \'' + self.context.params.action + '\''));
        }, 30000);
    },

    waitFor: function (action, timeout, callback) {

        if (typeof (timeout) === 'function') {
            callback = timeout;
            timeout = null;
        }

        timeout || (timeout = utils.WEBSOCKET_TIMEOUT);

        var self = this;
        this.context = {
            waitFor: {
                action: action,
                callback: callback
            },
            assertions: [],
            expectations: [],
            trueExpectations: [],
            falseExpectations: []
        };

        this.waitTimeoutId = setTimeout(function () {
            if (self.context.waitFor) {
                var action = self.context.waitFor.action;
                self.context.waitFor = null;
                callback(new Error('waitFor() timeout: hasn\'t got message \'' + action + '\' for ' + timeout + 'ms'));
            }
        }, timeout);

        return this;
    },

    onMessage: function (message) {
        console.log('<- %s', message.data);

        var data = JSON.parse(message.data);
        var done = this.context.done;

        if (this.context.waitFor){
            if (this.context.waitFor.action === data.action) {
                if (this.waitTimeoutId) {
                    clearTimeout(this.waitTimeoutId);
                    this.waitTimeoutId = null;
                }
                done = this.context.waitFor.callback;
                this.context.waitFor = null;
            } else {
                return;
            }
        }

        if (this.context.handled) {
            return;
        }

        this.context.handled = true;

        if (this.waitTimeoutId) {
            clearTimeout(this.waitTimeoutId);
            this.waitTimeoutId = null;
        }

        if (this.context.expectError) {
            assert.strictEqual(data.status, 'error', 'Error expected');
            utils.matches(data, this.context.expectError);
            return done(null, data);
        } else if (data.status === 'error') {
            return done(new Error(data.code + ' ' + data.error));
        }
        this.handleResults(data);

        done(null, data);
    },

    handleResults: function (data) {

        this.context.assertions.forEach(function (expectation) {
            if (typeof (expectation) !== 'function') {
                return;
            }

            expectation(data);
        });

        this.context.expectations.forEach(function (expectation) {
            utils.matches(data, expectation);
        });

        this.context.trueExpectations.forEach(function (expectation) {
            if (typeof (expectation) !== 'function') {
                return;
            }
            assert.strictEqual(expectation(data), true, 'Expression should return \'true\'');
        });

        this.context.falseExpectations.forEach(function (expectation) {
            if (typeof (expectation) !== 'function') {
                return;
            }
            assert.strictEqual(expectation(data), false, 'Expression should return \'false\'');
        });
    },

    close: function () {
        this.socket.close();
    }
};

module.exports = Websocket;