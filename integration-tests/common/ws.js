global.WebSocket = require('ws');
var utils = require('./utils');

function Websocket(url) {
    this.dateOpened = null;
    this.socket = new WebSocket(url);
}

Websocket.prototype = {

    connect: function (callback) {
        var self = this;

        this.socket.onopen = function () {
            self.dateOpened = new Date().toISOString();
            console.log('Connection opened at %s', self.dateOpened);
            return callback();
        };

        this.socket.onerror = function (err) {
            console.log(JSON.stringify(err));
        };

        this.socket.onclose = function () {
            console.log('Connection, which was opened at %s, closed', self.dateOpened);
        };
    },

    send: function (obj, done = utils.emptyCb) {
        var msg = JSON.stringify(obj);
        console.log('-> %s', msg);
        this.socket.send(msg);
    },

    on: function (obj = {}, callback = utils.emptyCb) {

        var received = false;

        this.socket.onmessage = function (message) {
            console.log('<- %s', JSON.stringify(message));
            var data = JSON.parse(message.data);
            utils.matches(data, obj);
            received = true;
            callback(null, data);
        };
        var timeout = utils.WEBSOCKET_TIMEOUT;
        setTimeout(function () {
            if (!received) {
                callback(new Error('waitFor() timeout: hasn\'t got message, for ' + timeout + 'ms'));
            }
        }, timeout);
    },

    close: function () {
        this.socket.close();
    }
};

module.exports = Websocket;