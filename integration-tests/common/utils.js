var async = require('async');
var assert = require('assert');
var path = require('./path');
var Http = require('./http').Http;
var status = require('./http').status;
var consts = require('./consts');

module.exports = {

    //url: 'http://nn7502.pg.devicehive.com/api',
    //url: 'http://192.168.152.147:8080/dh/rest',
    url: 'http://23.253.35.56:8081/DeviceHive/rest',

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
        password: consts.NEW_USER_PASSWORD
    },

    resources: [],

    create: function ($path, params, cb) {
        var self = this;
        new Http(this.url, $path)
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

    get: function ($path, params, cb) {
        new Http(this.url, path.get($path, params.id))
            .get(params, function (err, result, xhr) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(xhr.status, status.EXPECTED_READ);

                cb(null, result);
            });
    },

    update: function ($path, params, cb) {
        new Http(this.url, path.get($path, params.id))
            .put(params, function (err, result, xhr) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(xhr.status, status.EXPECTED_UPDATED);

                cb(null);
            });
    },

    delete: function ($path, params, cb) {
        new Http(this.url, path.get($path, params.id))
            .delete(params, function (err, result, xhr) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(xhr.status, status.EXPECTED_DELETED);

                cb(null);
            });
    },

    clearResources: function (cb) {
        var self = this;
        this.resources.reverse();
        async.eachSeries(this.resources, function(resource, callback) {
            var params = { user: self.admin };
            new Http(self.url, resource)
                .delete(params, function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    callback(null, result);
                });
        }, cb);
    },

    createUser: function (login, password, role, status, callback) {

        var params = {
            user: this.admin,
            data: {
                login: login,
                password: password,
                role: role,
                status: status
            }
        };

        this.create(path.USER, params, function (err, result) {
            callback(err, result)
        });
    },

    createUser2: function (role, networkIds, callback) {

        var self = this;

        var user = {
            login: '_integr-test-' + +new Date(),
            password: consts.NEW_USER_PASSWORD
        };

        this.createUser(user.login, user.password, role, 0, function (err, result) {
            if (err) {
                return callback(err);
            }

            var userId = result.id;
            async.eachSeries(networkIds,
                function (networkId, cb) {
                    var params = { user: self.admin };
                    var $path = path.combine(path.USER, userId, path.NETWORK, networkId);
                    new Http(self.url, $path)
                        .put(params, function (err, result, xhr) {
                            if (err) {
                                return cb(err);
                            }

                            assert.strictEqual(xhr.status, status.EXPECTED_UPDATED);
                            self.resources.push($path);
                            cb();
                        })
                },
                function (err) {
                    if (err) {
                        return callback(err);
                    }

                    callback(null, {user: user});
                })
        });
    }
}