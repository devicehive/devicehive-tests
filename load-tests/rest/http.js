var XMLHttpRequest = require('xhr2');
var utils = require('../../common/utils.js');

function Http() {
    this.xhr = new XMLHttpRequest();
    this.baseUrl = utils.getConfig('server:restUrl');
}

Http.prototype = {
    send: function(params, cb) {

        params.method = params.method || 'GET';
        var url = [this.baseUrl, params.path].join('');
        this.xhr.open(params.method, url, true);

        if (params.method === 'POST' || params.method === 'PUT') {
            this.xhr.setRequestHeader('Content-Type', 'application/json');
            params.data = JSON.stringify(params.data);
        }

        var self = this;
        this.xhr.onreadystatechange = function () {
            if (self.xhr.readyState !== 4) {
                return;
            }

            var isSuccess = self.xhr.status && self.xhr.status >= 200 && self.xhr.status < 300 || self.xhr.status === 304;
            var err = isSuccess ? void 0 : self.serverErrorMessage(self.xhr);

            var result = self.xhr.responseText ? JSON.parse(self.xhr.responseText) : null;
            return cb(err, result);
        }

        this.xhr.setRequestHeader('Authorization',
            'Bearer ' + utils.getConfig('server:accessKey'));

        this.xhr.send(params.data);
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

module.exports = Http;