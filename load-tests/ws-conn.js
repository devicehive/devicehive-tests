﻿global.WebSocket = require('ws');
var utils = require('../common/utils.js');
var deviceId = 1;

function WsConn(name, props) {
    this.id = deviceId++;
    this.name = name + '#' + this.id;
    this.actionCallbacks = {};
    this.socket = new WebSocket(utils.getConfig('server:wsUrl') + '/client');
    this.props = props;
}

WsConn.prototype = {
    
    connect: function () {
        console.log('%s connecting...', this.name);
        var self = this;
        
        this.socket.onopen = function (socket) {
            self.onOpen(socket);
        };
        this.socket.onmessage = function (message) {
            self.onMessage(message);
        };
        this.socket.onerror = function (err) {
            if (self.onerror) {
                self.onerror.call(self.errContext, err, self);
            }
        };
        this.socket.onclose = function (socket) {
            console.log('%s closed connection', self.name);
        };
    },
    
    onOpen: function (socket) {
        console.log('%s connected', this.name);
        this.authenticate();
    },
    
    authenticate: function () {
        
        console.log('%s authenticates...', this.name);
        
        var authData = {
            action : "authenticate",
            accessKey : utils.getConfig('server:accessKey'),
            login : null,
            password : null,
            requestId : utils.getRequestId()
        };
        
        this.send(JSON.stringify(authData));
    },
    
    send: function (data) {
        if (this.socket.readyState !== 1) { // OPEN state
            return;
        }
        this.socket.send(data);
    },
    
    onMessage: function (message) {
        
        var data = JSON.parse(message.data);
        var action = data.action;
        console.log('%s got message: %s', this.name, action);
        
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
    },

    toString: function () { 
        return "WsConn: " + this.name;
    }
}

module.exports = WsConn;