global.WebSocket = require('ws');
var utils = require('../common/utils.js');
var deviceId = 1;

function WsConn(name) {
    this.id = deviceId++;
    this.name = name + '#' + this.id;
    this.actionCallbacks = {};
    this.socket = new WebSocket(utils.getConfig('server:wsUrl') + '/client');
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
            self.onError(err);
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
        
        this.socket.send(JSON.stringify(authData));
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
    
    onError: function (err) {
        console.log('Error in %s: %s', this.name, JSON.stringify(err));
    }
}

module.exports = WsConn;