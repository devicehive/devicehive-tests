global.WebSocket = require('ws');
var utils = require('../../common/utils.js');
var log = require('../../common/log.js');
var connId = 1;

function WsSender(name, props) {
    this.id = connId++;
    this.name = name + '#' + this.id;
    this.actionCallbacks = {};
    this.socket = new WebSocket(utils.getConfig('server:wsUrl') + '/client');
    this.props = props;
}

WsSender.prototype = {

    connect: function () {
        log.debug('%s connecting...', this.name);
        var self = this;

        this.socket.onopen = function () {
            self.onOpen();
        };
        this.socket.onclose = function (event) {
            if (!event.wasClean) {
                var err = { message: 'connection lost' };
                self.onerror.call(self.errContext, err, self);
            }
        };
        this.socket.onmessage = function (message) {
            self.onMessage(message);
        };
        this.socket.onerror = function (err) {
            if (self.onerror) {
                self.onerror.call(self.errContext, err, self);
            }
        };
        this.socket.onclose = function () {
            log.debug('%s closed connection', self.name);
        };
    },

    onOpen: function () {
        log.debug('%s connected', this.name);
        this.authenticate();
    },

    authenticate: function () {

        log.debug('%s authenticates...', this.name);

        var authData = {
            action : "authenticate",
            accessKey : utils.getConfig('server:accessKey'),
            login : null,
            password : null,
            requestId : utils.getRequestId()
        };

        this.send(authData);
    },

    send: function (data) {
        if (this.socket.readyState !== 1) { // OPEN state
            return;
        }
        var $data = JSON.stringify(data);
        log.debug('-> %s', $data);
        this.socket.send($data);
    },

    onMessage: function (message) {
        log.debug('<- %s', message.data);

        var data = JSON.parse(message.data);
        var action = data.action;

        var subscription = action ? this.actionCallbacks[action] : null;
        if (subscription) {
            subscription.cb.call(subscription.context, data, this);
        }
    },

    addActionCallback: function (action, cb, context) {
        context || (context = this);
        this.actionCallbacks[action] = {
            context: context,
            cb: cb
        };
    },

    addErrorCallback: function (cb, context) {
        context || (context = this);
        this.onerror = cb;
        this.errContext = context;
    }
};

module.exports = WsSender;