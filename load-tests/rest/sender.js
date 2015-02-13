var utils = require('../../common/utils.js');
var testUtils = require('./../common/test-utils');
var Http = require('./http');

function Sender(context) {
    this.context = context;
    this.requestTime = {};
}

Sender.prototype = {
    send: function(responseCb) {

        var self = this;
        var context = this.context;
        var requestId = utils.getRequestId();

        var request = utils.clone(context.requests[requestId % context.requests.length]);
        testUtils.substitute(request.data, '{#name}', function () {
            return context.names[requestId % context.names.length];
        })

        var deviceGuid = testUtils.getDeviceGuid(context, requestId);

        var params = {
            method: request.method,
            path: '/device/' + deviceGuid + '/notification',
            data: request.data
        };

        var http = new Http(requestId);
        this.requestTime[requestId] = +new Date();
        http.send(params, function (err, requestId, result) {
            responseCb(err, self, requestId, result);
        });
    }
}

module.exports = Sender;