var async = require('async');
var assert = require('assert');
var path = require('./path');
var Http = require('./http').Http;
var status = require('./http').status;

module.exports = {

    admin: {
        login: 'dhadmin',
        password: 'dhadmin_#911'
    },

    //admin: {
    //    login: 'admin',
    //    password: 'Password1@'
    //},

    owner: {
        login: '_ingegr-test-usr',
        password: 'Qwe12345!'
    },

    resources: [],

    create: function (url, $path, params, cb) {
        var self = this;
        new Http(url, $path)
            .post(params, function (err, result, xhr) {
                if (err) {
                    return cb(err);
                }

                var resource = path.get($path, result.id);
                self.resources.push(resource)
                assert.strictEqual(xhr.status, status.EXPECTED_CREATED);

                cb(null, result, resource);
            });
    },

    get: function (url, $path, params, cb) {
        new Http(url, path.get($path, params.id))
            .get(params, function (err, result, xhr) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(xhr.status, status.OK);

                cb(null, result);
            });
    },

    update: function (url, $path, params, cb) {
        new Http(url, path.get($path, params.id))
            .put(params, function (err, result, xhr) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(xhr.status, status.EXPECTED_UPDATED);

                cb(null);
            });
    },

    delete: function (url, $path, params, cb) {
        new Http(url, path.get($path, params.id))
            .delete(params, function (err, result, xhr) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(xhr.status, status.EXPECTED_DELETED);

                cb(null);
            });
    },

    clearResources: function (url, cb) {
        var self = this;
        this.resources.reverse();
        async.eachSeries(this.resources, function(resource, callback) {
            var params = { user: self.admin };
            new Http(url, resource)
                .delete(params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    callback(null, result);
                });
        }, cb);
    }
}