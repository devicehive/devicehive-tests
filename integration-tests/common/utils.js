var async = require('async');
var assert = require('assert');
var path = require('./path');
var Http = require('./http').Http;
var status = require('./http').status;
var consts = require('./consts');
var $utils = require('./../../common/utils');

var utils = {

    core: $utils,

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

    user: {
        login: '_ingegr-test-usr',
        password: consts.NEW_USER_PASSWORD
    },

    resources: [],

    accessKey: {

        create: function (user, label, actions, deviceIds, networkIds, callback) {

            label || (label = '_integr-test-access-key-' + +new Date());

            if (actions && !Array.isArray(actions)) {
                actions = [actions];
            }

            if (deviceIds && !Array.isArray(deviceIds)) {
                deviceIds = [deviceIds];
            }

            if (networkIds && !Array.isArray(networkIds)) {
                networkIds = [networkIds];
            }

            var expDate = new Date();
            expDate.setFullYear(expDate.getFullYear() + 10);

            var params = this.getParamsObj(label, user, expDate, void 0, networkIds, actions, deviceIds, void 0);
            utils.create(path.CURRENT_ACCESS_KEY, params, callback);
        },

        getParams: function (label, user, expDate, domains, networkIds, actions, deviceGuids, subnets) {

            expDate || (expDate = new Date());
            expDate.setFullYear(expDate.getFullYear() + 10);

            return this.getParamsObj(label, user, expDate,
                domains || ['www.example.com'],
                networkIds || [1, 2],
                actions || ['GetNetwork', 'GetDevice'],
                deviceGuids || ['11111111-2222-3333-4444-555555555555'],
                subnets || ['127.0.0.1']);
        },

        getParamsObj: function (label, user, expDate, domains, networkIds, actions, deviceGuids, subnets) {

            var permission = {};

            if (domains) {
                permission.domains = domains;
            }

            if (networkIds) {
                permission.networkIds = networkIds;
            }

            if (actions) {
                permission.actions = actions;
            }

            if (deviceGuids) {
                permission.deviceGuids = deviceGuids;
            }

            if (subnets) {
                permission.subnets = subnets;
            }

            var params = {
                data: {
                    label: label,
                    permissions: [permission]
                }
            };

            if (user) {
                params.user = user;
            }

            if (expDate) {
                params.data.expirationDate = expDate.toISOString();
            }

            return params;
        },

        expectAccessKey: function (actual, expected) {
            assert.strictEqual(+new Date(actual.expirationDate), +new Date(expected.expirationDate));
            assert.strictEqual(actual.label, expected.label);
            assert.deepEqual(actual.permissions, expected.permissions);
        }
    },

    deviceClass: {

        getParams: function (name, user, version) {
            return this.getParamsObj(name, user, version, void 0, 3600,
                {
                    name: '_integr-test-eqpmnt',
                    type: '_integr-test-type',
                    code: '_integr-test-code'
                });
        },

        getParamsObj: function (name, user, version, isPermanent, offlineTimeout, equipment, data) {

            var params = {
                user: user,
                data: {
                    name: name,
                    version: version
                }
            };

            if (typeof (isPermanent) === 'boolean') {
                params.data.isPermanent = isPermanent;
            }

            if (offlineTimeout) {
                params.data.offlineTimeout = offlineTimeout;
            }

            if (equipment) {
                params.data.equipment = [equipment];
            }

            if (data) {
                params.data.data = data;
            }

            return params;
        }
    },

    device: {
        getParamsObj: function (name, user, key, network, deviceClass) {

            var params = {
                user: user,
                data: {
                    name: name
                }
            };

            if (key) {
                params.data.key = key;
            }

            if (network) {
                params.data.network = network;
            }

            if (deviceClass) {
                params.data.deviceClass = deviceClass;
            }

            return params;
        }
    },

    notification: {
        getParamsObj: function (notification, user, parameters) {
            var params = {
                user: user,
                data: {
                    notification: notification,
                    parameters: parameters
                }
            };
            return params;
        }
    },

    create: function ($path, params, cb) {
        var self = this;
        new Http(this.url, $path)
            .post(params, function (err, result, xhr) {
                if (err) {
                    err.httpStatus = xhr.status;
                    return cb(err);
                }

                var resource = path.get($path, result.id);
                self.resources.push(resource);
                assert.strictEqual(xhr.status, status.EXPECTED_CREATED);

                cb(null, result, resource);
            });
    },

    get: function ($path, params, cb) {
        new Http(this.url, path.get($path, params.id))
            .get(params, function (err, result, xhr) {
                if (err) {
                    err.httpStatus = xhr.status;
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
                    err.httpStatus = xhr.status;
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
                    err.httpStatus = xhr.status;
                    return cb(err);
                }

                assert.strictEqual(xhr.status, status.EXPECTED_DELETED);

                cb(null);
            });
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

        networkIds || (networkIds = []);
        if (!Array.isArray(networkIds)) {
            networkIds = [networkIds];
        }

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
    },

    clearResources: function (done) {
        var self = this;
        this.resources.reverse();
        async.eachSeries(this.resources,
            function(resource, callback) {
                new Http(self.url, resource)
                    .delete({ user: self.admin }, function (err, result) {
                        // Ignore any errors
                        callback();
                    });
            },
            function () {
                self.resources = [];
                done();
            });
    }
};

module.exports = utils;