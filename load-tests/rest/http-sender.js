var XMLHttpRequest = require('xhr2');
var utils = require('../../common/utils.js');
var testUtils = require('./../common/test-utils');

function HttpSender(context) {
    this.context = context;
    this.baseUrl = utils.getConfig('server:restUrl');
    this.requestTime = {};
    this.requestId = utils.getRequestId();
}

HttpSender.prototype = {

    type: {
        notification: function (sender, request) {
            var deviceGuid = testUtils.getDeviceGuid(sender.context, sender.requestId);

            return {
                method: request.method,
                path: '/device/' + deviceGuid + '/notification',
                data: request.data
            };
        },
        command: function (sender, request) {
            var deviceGuid = testUtils.getDeviceGuid(sender.context, sender.requestId);

            return {
                method: request.method,
                path: '/device/' + deviceGuid + '/command',
                data: request.data
            };
        }
    },

    send: function(responseCb) {
        var self = this;
        var request = this.getRequest();
        var params = this.type[request.type](self, request);
        this.requestTime[this.requestId] = +new Date();
        this.sendRequest(params, function (err, result) {
            responseCb(err, self, result);
        });
    },

    getRequest: function () {
        var self = this;
        var context = this.context;
        var request = utils.clone(context.requests[this.requestId % context.requests.length]);

        testUtils.substitute(request.data, '{#name}', function () {
            return context.names[self.requestId % context.names.length];
        })

        testUtils.substitute(request.data, '{#deviceGuid}', function () {
            return testUtils.getDeviceGuid(context, self.requestId);
        });

        testUtils.substitute(request.data, '{#deviceGuids}', function () {
            return testUtils.getDeviceGuids(context, self.requestId);
        });

        testUtils.substitute(request.data, '{#requestId}', function () {
            return self.requestId;
        });

        return request;
    },

    sendRequest: function(params, cb) {

        var xhr = new XMLHttpRequest();

        params.method = params.method || 'GET';
        var url = [this.baseUrl, params.path].join('');
        xhr.open(params.method, url, true);

        if (params.method === 'POST' || params.method === 'PUT') {
            xhr.setRequestHeader('Content-Type', 'application/json');
            params.data = JSON.stringify(params.data);
        }

        var self = this;
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) {
                return;
            }

            var isSuccess = xhr.status && xhr.status >= 200 && xhr.status < 300 || xhr.status === 304;
            var err = isSuccess ? void 0 : self.serverErrorMessage(xhr);

            var result = xhr.responseText ? JSON.parse(xhr.responseText) : null;
            return cb(err, result);
        }

        xhr.setRequestHeader('Authorization',
            'Bearer ' + utils.getConfig('server:accessKey'));

        xhr.send(params.data);
    },

    serverErrorMessage: function (http) {
        var errMsg = 'DeviceHive server error';
        if (http.responseText) {
            try {
                errMsg += ' - ' + JSON.parse(http.responseText).message;
            }
            catch (e) {
                errMsg += ' - ' + http.responseText;
            }
        }
        return {error: errMsg, request: http};
    }
}

module.exports = HttpSender;