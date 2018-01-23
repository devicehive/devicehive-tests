var async = require('async');
var assert = require('assert');
var jwt_decode = require('jwt-decode');
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

    NAME_PREFIX: 'it-',
    NON_EXISTING_ID: 999999,
    NEW_USER_PASSWORD: 'new_user_password',
    WEBSOCKET_TIMEOUT: 4000,

    emptyCb: function () { },

    core: $utils,

    url:  getParam("restUrl") ,

    authUrl:  getParam("authRestUrl") ,

    pluginUrl:  getParam("pluginRestUrl") ,

    admin: {
        login: 'dhadmin',
        password: 'dhadmin_#911',
        id:1
    },

    loggingOff: false,

    jwt: {
        admin: 'eyJhbGciOiJIUzI1NiJ9.eyJwYXlsb2FkIjp7InUiOjEsImEiOlswXSwibiI6WyIqIl0sImR0IjpbIioiXSwiZSI6MTU1OTM0NzIwMDAwMCwidCI6MX19.0i1MaUBtgfDPG4_cvSjEVO11FZy7o_L_6uRCR5NR3v4',
        admin_refresh: 'eyJhbGciOiJIUzI1NiJ9.eyJwYXlsb2FkIjp7InUiOjEsImEiOlswXSwibiI6WyIqIl0sImR0IjpbIioiXSwiZSI6MTU1OTM0NzIwMDAwMCwidCI6MH19.FhgGiIFMl7PSiaHMXGFlJTMKUyjA_JXjU_Qk2pjGna4',
        admin_refresh_exp: 'eyJhbGciOiJIUzI1NiJ9.eyJwYXlsb2FkIjp7InUiOjEsImEiOlswXSwibiI6WyIqIl0sImR0IjpbIioiXSwiZSI6MTQ2NDc5MzI5MDU2NCwidCI6MH19.NdKR2zLvBeMuvGEDf4BC7a8YxqdvdKjnqIKdFn2KpJU',
        admin_refresh_invalid: 'eyJhbGciOiJIUzI1NiJ9.eyJwYXlsb2FkIjp7InUiOjEsImEiOlswXSwibiI6WyIqIl0sImQiOlsiKiJdLCJlIjoxNTE0NzY0ODAwMDAwLCJ0IjoxfX0.dkA2H1MGmJHdAT382tqt-xhcmwwlTimGwnabS5HdfJc',
        admin_refresh_invalid_signature: 'eyJhbGciOiJIUzI1NiJ9.eyJwYXlsb2FkIjp7InUiOjEsImEiOlswXSwibiI6WyIqIl0sImQiOlsiKiJdLCJlIjoxNTU5MzQ3MjAwMDAwLCJ0IjowfX0.lo2T-wbXe1J9DvVyxJtFkNlo76uH_kSVwVY-FxLZRkk',
        createMany: function (params, done) {
            var paramsCopy = params.slice(0);
            function createJWT(callback) {
                var p = paramsCopy.shift();
                utils.jwt.create(p.user.id, p.actions, p.networkIds, p.deviceTypeIds,
                    function (err, result) {
                        if (err) {
                            callback(err);
                        }

                        callback(null, result.accessToken);
                    });
            }

            var callbacks = [];
            for (var i = 0; i < paramsCopy.length; i++) {
                callbacks.push(createJWT);
            }

            async.series(callbacks, done);
        },

        createManyRefresh: function (params, done) {
            var paramsCopy = params.slice(0);
            function createJWT(callback) {
                var p = paramsCopy.shift();
                utils.jwt.create(p.user.id, p.actions, p.networkIds, p.deviceTypeIds,
                    function (err, result) {
                        if (err) {
                            callback(err);
                        }

                        callback(null, result.refreshToken);
                    });
            }

            var callbacks = [];
            for (var i = 0; i < paramsCopy.length; i++) {
                callbacks.push(createJWT);
            }

            async.series(callbacks, done);
        },

        create: function (userId, actions, networkIds, deviceTypeIds, callback) {

            if (actions && !Array.isArray(actions)) {
                actions = [actions];
            }

            if (networkIds && !Array.isArray(networkIds)) {
                networkIds = [networkIds];
            }

            if (deviceTypeIds && !Array.isArray(deviceTypeIds)) {
                deviceTypeIds = [deviceTypeIds];
            }

            var expDate = new Date();
            expDate.setFullYear(expDate.getFullYear() + 10);

            utils.createAuth(path.JWT + '/create', {jwt: utils.jwt.admin, data: {userId: userId, actions: actions, networkIds: networkIds, deviceTypeIds: deviceTypeIds, expiration: expDate }}, callback);
        }
    },
    
    action: {
        Any: 0,
        None: 1,
        GetNetwork: 2,
        GetDevice: 3,
        GetDeviceNotification: 4,
        GetDeviceCommand: 5,
        RegisterDevice: 6,
        CreateDeviceCommand: 7,
        UpdateDeviceCommand: 8,
        CreateDeviceNotification: 9,
        GetCurrentUser: 10,
        UpdateCurrentUser: 11,
        ManageUser: 12,
        ManageConfiguration: 13,
        ManageNetwork: 14,
        ManageToken: 15,
        GetDeviceType: 16,
        ManageDeviceType: 17
    },

    device: {
        getParamsObj: function (name, jwt, networkId) {
            var params = {
                jwt: jwt,
                data: {
                    name: name,
                    networkId: null
                }
            };

            if (networkId) {
                params.data.networkId = networkId;
            }

            if (jwt) {
                params.jwt = jwt;
            }

            return params;
        }
    },

    notification: {
        getParamsObj: function (notification, jwt, parameters, timestamp) {
            return {
                jwt: jwt,
                data: {
                    notification: notification,
                    parameters: parameters,
                    timestamp: timestamp
                }
            };
        }
    },

    command: {
        getParamsObj: function (command, jwt, parameters, timestamp) {
            var params = {
                jwt: jwt,
                data: {
                    command: command
                }
            };

            if (parameters) {
                params.data.parameters = parameters;
            }

            if (timestamp) {
                params.data.timestamp = timestamp;
            }

            return params;
        }
    },

    configuration: {
        get: function (name, cb, status) {
            utils.get(path.CONFIGURATION, {id: name}, cb, status)
        }
    },

    create: function ($path, params, cb) {
        new Http(this.url, path.get($path, null, params.query), this.loggingOff)
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

    createAuth: function ($path, params, cb) {
        new Http(this.authUrl, $path, this.loggingOff)
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

    createPlugin: function ($path, params, cb) {
        new Http(this.pluginUrl, path.get($path, null, params.query), this.loggingOff)
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
        if(!responseStatus){responseStatus = status.EXPECTED_READ}
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

    getAuth: function ($path, params, cb, responseStatus) {
        if(!responseStatus){responseStatus = status.EXPECTED_READ}
        new Http(getParam("authRestUrl"), path.get($path, params.id, params.query), this.loggingOff)
            .get(params, function (err, result, xhr) {
                if (err) {
                    err.httpStatus = xhr.status;
                    return cb(err);
                }

                assert.strictEqual(xhr.status, responseStatus);

                cb(null, result);
            });
    },

    getPlugin: function ($path, params, cb, responseStatus) {
        if(!responseStatus){responseStatus = status.EXPECTED_READ}
        new Http(getParam("pluginRestUrl"), path.get($path, params.id, params.query), this.loggingOff)
            .get(params, function (err, result, xhr) {
                if (err) {
                    err.httpStatus = xhr.status;
                    return cb(err);
                }

                assert.strictEqual(xhr.status, responseStatus);

                cb(null, result);
            });
    },

    getBackend: function ($path, params, cb, responseStatus) {
        if(!responseStatus){responseStatus = status.EXPECTED_READ}
        new Http(getParam("backendRestUrl"), path.get($path, params.id, params.query), this.loggingOff)
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
            jwt: this.jwt.admin,
            data: {
                login: login,
                password: password,
                role: role,
                status: status,
                allDeviceTypesAvailable: false
            }
        };

        this.create(path.USER, params, function (err, result) {
            callback(err, result)
        });
    },

    createReviewedIntroUser: function (login, password, role, status, callback) {

        var params = {
            jwt: this.jwt.admin,
            data: {
                login: login,
                password: password,
                role: role,
                status: status,
                introReviewed: true
            }
        };

        this.create(path.USER, params, function (err, result) {
            callback(err, result)
        });
    },

    createAllDTAvailableUser: function (login, password, role, status, callback) {

        var params = {
            jwt: this.jwt.admin,
            data: {
                login: login,
                password: password,
                role: role,
                status: status,
                allDeviceTypesAvailable: true
            }
        };

        this.create(path.USER, params, function (err, result) {
            callback(err, result)
        });
    },

    getName: function ($for) {
        return [this.NAME_PREFIX, $for, '-', Date.now(), '-', Math.floor(Math.random() * 100) + 1].join('');
    },

    getInvalidName: function () {
        //Name will be longer than constraints allow
        return (Math.random()*1e256).toString(36)
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

        this.createAllDTAvailableUser(user.login, user.password, role, 0, function (err, result) {
            if (err) {
                return callback(err);
            }

            user.id = result.id;
            async.eachSeries(networkIds,
                function (networkId, cb) {
                    var params = { jwt: self.jwt.admin };
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

    createUser3: function (role, networkIds, status, callback) {

        var self = this;

        var user = {
            login: this.getName('user'),
            password: this.NEW_USER_PASSWORD
        };

        networkIds || (networkIds = []);
        if (!Array.isArray(networkIds)) {
            networkIds = [networkIds];
        }

        this.createUser(user.login, user.password, role, status, function (err, result) {
            if (err) {
                return callback(err);
            }

            user.id = result.id;
            async.eachSeries(networkIds,
                function (networkId, cb) {
                    var params = { jwt: self.jwt.admin };
                    var $path = path.combine(path.USER, user.id, path.NETWORK, networkId);
                    new Http(self.url, $path)
                        .put(params, function (err) {
                            if (err) {
                                return cb(err);
                            }
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

    createUser4: function (role, deviceTypeIds, callback) {

        var self = this;

        var user = {
            login: this.getName('user'),
            password: this.NEW_USER_PASSWORD
        };

        deviceTypeIds || (deviceTypeIds = []);
        if (!Array.isArray(deviceTypeIds)) {
            deviceTypeIds = [deviceTypeIds];
        }

        this.createUser(user.login, user.password, role, 0, function (err, result) {
            if (err) {
                return callback(err);
            }

            user.id = result.id;
            async.eachSeries(deviceTypeIds,
                function (deviceTypeId, cb) {
                    var params = { jwt: self.jwt.admin };
                    var $path = path.combine(path.USER, user.id, path.DEVICE_TYPE, deviceTypeId);
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

        function clearNetworks(callback) {
            clearEntities(path.NETWORK, 'name', callback);
        }

        self.loggingOff = true;
        async.series([
            clearAccessKeys,
            clearUsers,
            clearDevices,
            clearNetworks
        ], function (err) {
            if (err) {
                done(err);
            }
            self.loggingOff = false;
            done();
        });
    },

    clearDataJWT: function (done) {

        var self = this;
        function clearEntities(path, name, callback) {
            utils.get(path, {jwt: utils.jwt.admin}, function (err, result) {
                if (err) {
                    return callback(err);
                }

                async.eachSeries(result, function (item, cb) {
                    if (item[name] == null || item[name].indexOf(self.NAME_PREFIX) < 0) {
                        return cb();
                    }

                    utils.delete(path, {jwt: utils.jwt.admin, id: item.id}, cb);
                }, callback)
            });
        }

        function clearUsers(callback) {
            clearEntities(path.USER, 'login', callback);
        }

        function clearDevices(callback) {
            clearEntities(path.DEVICE, 'name', callback);
        }

        function clearNetworks(callback) {
            clearEntities(path.NETWORK, 'name', callback);
        }

        function clearDeviceTypes(callback) {
            clearEntities(path.DEVICE_TYPE, 'name', callback);
        }

        self.loggingOff = true;
        async.series([
            clearUsers,
            clearDevices,
            clearNetworks,
            clearDeviceTypes
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
    },

    parseJwt: function (token) {
        return jwt_decode(token);
    }
};

module.exports = utils;
