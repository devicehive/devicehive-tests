var async = require('async');
var assert = require('assert');
var path = require('./path');
var Http = require('./http').Http;
var status = require('./http').status;
var $utils = require('./../../common/utils');

function getParam(key) {
    for (var index in process.argv) {
        var parameter = process.argv[index];
        if (parameter.indexOf("--" + key) == 0)
            return parameter.substr(key.length + 3);
    }
    return $utils.getConfig('server:' + key);
}

var utils = {

    NAME_PREFIX: '_it-',
    NON_EXISTING_ID: 999999,
    NEW_USER_PASSWORD: 'new_user_password',

    emptyCb: function () { },

    core: $utils,

    url:  getParam("restUrl") ,

    admin: {
        login: 'dhadmin',
        password: 'dhadmin_#911'
        //password: 'Password1@'
    },

    loggingOff: false,

    accessKey: {

        admin: "1jwKgLYi/CdfBTI9KByfYxwyQ6HUIEfnGSgakdpFjgk=",

        createMany: function (params, done) {

            function createAccessKey(callback) {
                var p = params.shift();
                utils.accessKey.create(p.user, p.label, p.actions, p.deviceIds, p.networkIds,
                    function (err, result) {
                        if (err) {
                            callback(err);
                        }

                        callback(null, result.key);
                    });
            }

            var callbacks = [];
            for (var i = 0; i < params.length; i++) {
                callbacks.push(createAccessKey);
            }

            async.series(callbacks, done);
        },

        create: function (user, label, actions, deviceIds, networkIds, callback) {

            label || (label = utils.getName('access-key'));

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
                    name: utils.getName('eqpmnt'),
                    type: utils.getName('type'),
                    code: utils.getName('code')
                });
        },

        getParamsObj: function (name, user, version, isPermanent, offlineTimeout, equipment, data) {

            var params = {
                user: user,
                data: {
                    name: name
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
        getParamsObj: function (name, user, network, deviceClass, accessKey) {
            var params = {
                user: user,
                data: {
                    name: name,
                    network: 'invalid'
                }
            };

            if (network) {
                params.data.network = network;
            }

            if (deviceClass) {
                params.data.deviceClass = deviceClass;
            }

            if (accessKey) {
                params.accessKey = accessKey;
            }

            return params;
        }
    },

    notification: {
        getParamsObj: function (notification, user, parameters) {
            return {
                user: user,
                data: {
                    notification: notification,
                    parameters: parameters
                }
            };
        }
    },

    command: {
        getParamsObj: function (command, user, parameters) {
            var params = {
                user: user,
                data: {
                    command: command
                }
            };

            if (parameters) {
                params.data.parameters = parameters;
            }

            return params;
        }
    },

    create: function ($path, params, cb) {
        new Http(this.url, $path, this.loggingOff)
            .post(params, function (err, result, xhr) {
                if (err) {
                    err.httpStatus = xhr.status;
                    return cb(err);
                }

                var resource = path.get($path, result.id);
                assert.strictEqual(xhr.status, status.EXPECTED_CREATED);

                cb(null, result, resource);
            });
    },

    get: function ($path, params, cb, responseStatus) {
        if(!responseStatus){responseStatus = status.EXPECTED_READ};
        new Http(this.url, path.get($path, params.id, params.query), this.loggingOff)
            .get(params, function (err, result, xhr) {
                if (err) {
                    err.httpStatus = xhr.status;
                    return cb(err);
                }

                assert.strictEqual(xhr.status, responseStatus);

                cb(null, result);
            });
    },

    update: function ($path, params, cb) {
        var updatePath = path.get($path, params.id, params.query);
        new Http(this.url, updatePath, this.loggingOff)
            .put(params, function (err, result, xhr) {
                if (err) {
                    err.httpStatus = xhr.status;
                    return cb(err);
                }

                if (result) {
                    assert.strictEqual(xhr.status, status.EXPECTED_READ);
                } else {
                    assert.strictEqual(xhr.status, status.EXPECTED_UPDATED);
                }

                cb(null, result);
            });
    },

    delete: function ($path, params, cb) {
        new Http(this.url, path.get($path, params.id, params.query), this.loggingOff)
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

    getName: function ($for) {
        return [this.NAME_PREFIX, $for, '-', (+new Date() + '').substr(7)].join('');
    },

    createUser2: function (role, networkIds, callback) {

        var self = this;

        var user = {
            login: this.getName('user'),
            password: this.NEW_USER_PASSWORD
        };

        networkIds || (networkIds = []);
        if (!Array.isArray(networkIds)) {
            networkIds = [networkIds];
        }

        this.createUser(user.login, user.password, role, 0, function (err, result) {
            if (err) {
                return callback(err);
            }

            user.id = result.id;
            async.eachSeries(networkIds,
                function (networkId, cb) {
                    var params = { user: self.admin };
                    var $path = path.combine(path.USER, user.id, path.NETWORK, networkId);
                    new Http(self.url, $path)
                        .put(params, function (err, result, xhr) {
                            if (err) {
                                return cb(err);
                            }

                            assert.strictEqual(xhr.status, status.EXPECTED_UPDATED);
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

    clearData: function (done) {

        var self = this;
        function clearEntities(path, name, callback) {
            utils.get(path, {user: utils.admin}, function (err, result) {
                if (err) {
                    return callback(err);
                }

                async.eachSeries(result, function (item, cb) {
                    if (item[name] == null || item[name].indexOf(self.NAME_PREFIX) < 0) {
                        return cb();
                    }

                    utils.delete(path, {user: utils.admin, id: item.id}, cb);
                }, callback)
            });
        }

        function clearAccessKeys(callback) {
            clearEntities(path.CURRENT_ACCESS_KEY, 'label', callback);
        }

        function clearUsers(callback) {
            clearEntities(path.USER, 'login', callback);
        }

        function clearDevices(callback) {
            clearEntities(path.DEVICE, 'name', callback);
        }

        function clearDeviceClasses(callback) {
            clearEntities(path.DEVICE_CLASS, 'name', callback);
        }

        function clearNetworks(callback) {
            clearEntities(path.NETWORK, 'name', callback);
        }

        function clearOAuthClients(callback) {
            clearEntities(path.combine('/', 'oauth', 'client'), 'name', callback);
        }

        self.loggingOff = true;
        async.series([
            clearAccessKeys,
            clearUsers,
            clearDevices,
            clearDeviceClasses,
            clearNetworks,
            clearOAuthClients
        ], function (err) {
            if (err) {
                done(err);
            }
            self.loggingOff = false;
            done();
        });
    },

    hasPropsWithValues: function (obj, props) {
        this.hasProps(obj, props);
        Object.keys(obj).forEach(function (key) {
            assert.notStrictEqual(typeof obj[key], 'undefined', 'Expected property \'' + key + '\' should have value');
        });
    },

    hasProps: function (obj, props) {
        this.arraysEqual(Object.keys(obj), props);
    },

    arraysEqual: function (actual, expected) {
        this.matches(actual.sort(), expected.sort());
    },

    matches: function (actual, expected) {

        var keys = Object.keys(expected);

        keys.forEach(function (key) {

            assert.strictEqual(actual.hasOwnProperty(key), true, 'Expected object should have key \'' + key + '\'');

            var ac = actual[key];
            var ex = expected[key];

            if (Array.isArray(ex)) {
                assert.strictEqual(Array.isArray(ac), true, 'Expected object should be array');
                assert.strictEqual(ac.length, ex.length, 'Expected array length should be \'' + ex.length + '\'');
                utils.matches(ac, ex);
                return;
            }

            if (ex && (typeof (ex) === 'object')) {
                utils.matches(ac, ex);
                return;
            }

            assert.strictEqual(ac, ex, 'Expected value for \'' + key + '\' should be: \'' + ex + '\'');
        });
    }
};

module.exports = utils;
