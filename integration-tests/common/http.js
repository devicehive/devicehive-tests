var XMLHttpRequest = require('xhr2');
var utils = require('../../common/utils.js');

var status = {
    EXPECTED_READ: 200,
    EXPECTED_CREATED: 201,
    EXPECTED_UPDATED: 204,
    EXPECTED_DELETED: 204,
    BAD_REQUEST: 400,
    NOT_AUTHORIZED: 401,
    NOT_FOUND: 404
};

function Http(baseUrl, path) {
    this.url = [baseUrl, path].join('');
}

Http.prototype = {

    get: function (params, cb) {
        params.method = 'GET';
        this.sendRequest(params, cb);
    },

    post: function (params, cb) {
        params.method = 'POST';
        this.sendRequest(params, cb);
    },

    put: function (params, cb) {
        params.method = 'PUT';
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

            /* hack */
            if (xhr.responseText === '{message:\"Not authorized\"}') {
                xhr.responseText = '{\"message\":\"Not authorized\"}';
            }
            /* hack */

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

module.exports = {
    Http: Http,
    status: status
};