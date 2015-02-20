var XMLHttpRequest = require('xhr2');
var utils = require('../common/utils.js');

function HttpSender(baseUrl, path) {
    this.url = [baseUrl, path].join('');
}

HttpSender.prototype = {

    get: function (params, cb) {
        params.method = 'GET';
        this.sendRequest(params, cb);
    },

    post: function (params, cb) {
        params.method = 'POST';
        this.sendRequest(params, cb);
    },

    delete: function (params, cb) {
        params.method = 'DELETE';
        this.sendRequest(params, cb);
    },

    sendRequest: function(params, cb) {

        var xhr = new XMLHttpRequest();

        params.method = params.method || 'GET';
        xhr.open(params.method, this.url, true);

        var jsonData = '';

        if (params.method === 'POST' || params.method === 'PUT') {
            xhr.setRequestHeader('Content-Type', 'application/json');
            jsonData = JSON.stringify(params.data);
        }

        var self = this;
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) {
                return;
            }

            var isSuccess = xhr.status && xhr.status >= 200 && xhr.status < 300 || xhr.status === 304;
            var err = isSuccess ? void 0 : self.serverErrorMessage(xhr);

            var result = xhr.responseText ? JSON.parse(xhr.responseText) : null;
            return cb(err, result, xhr);
        }

        if (params.accessKey) {
            xhr.setRequestHeader('Authorization', 'Bearer ' + params.accessKey);
        } else if (params.user) {
            xhr.setRequestHeader('Authorization',
                'Basic ' + utils.encodeBase64(params.user.login + ':' + params.user.password));
        } else if (params.device) {
            xhr.setRequestHeader('Auth-DeviceID', params.device.id);
            xhr.setRequestHeader('Auth-DeviceKey', params.device.key);
        }

        xhr.send(jsonData);
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