﻿var config = require('nconf').argv().env().file({
    file: require('path').resolve(__dirname, '../config.json')
});

var requestId = 1;

module.exports = {

    getRequestId: function () { 
        return requestId++;
    },

    getConfig: function (key) {
        return config.get(key);
    },

    clone: function (obj) {
        
        var self = this;

        if (obj == null || typeof (obj) != 'object')
            return obj;

        var copy = obj.constructor();
        var keys = Object.keys(obj);
        keys.forEach(function (key) { 
            copy[key] = self.clone(obj[key]);
        });

        return copy;
    },

    encodeBase64: function (data) {
        var b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        var o1, o2, o3, h1, h2, h3, h4, bits, i = 0, ac = 0, enc = "", tmp_arr = [];
        if (!data) {
            return data;
        }
        do { // pack three octets into four hexets
            o1 = data.charCodeAt(i++);
            o2 = data.charCodeAt(i++);
            o3 = data.charCodeAt(i++);
            bits = o1 << 16 | o2 << 8 | o3;
            h1 = bits >> 18 & 0x3f;
            h2 = bits >> 12 & 0x3f;
            h3 = bits >> 6 & 0x3f;
            h4 = bits & 0x3f;

            // use hexets to index into b64, and append result to encoded string
            tmp_arr[ac++] = b64.charAt(h1) + b64.charAt(h2) + b64.charAt(h3) + b64.charAt(h4);
        } while (i < data.length);
        enc = tmp_arr.join('');
        var r = data.length % 3;
        return (r ? enc.slice(0, r - 3) : enc) + '==='.slice(r || 3);
    },

    hasStringValue: function (value) {
        return !(!value) &&
            (typeof(value) === 'string') &&
            (value.length > 0);
    },

    isArrayNonEmpty: function (obj) {

        if (!Array.isArray(obj)) {
            return false;
        }

        return obj.length > 0;
    },

    isArrayOfLength: function (obj, expectedLength) {

        if (!Array.isArray(obj)) {
            return false;
        }

        return obj.length === expectedLength;
    },

    isEmptyArray: function (obj) {

        if (!Array.isArray(obj)) {
            return false;
        }

        return obj.length === 0;
    }
}