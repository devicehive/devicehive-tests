var assert = require('assert');
var async = require('async');
var format = require('util').format;
var should = require('should');
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;
var req = require('./common/request');

describe('REST API JSON Web Tokens', function () {
    this.timeout(90000);

    var PLUGIN = utils.getName('plugin');
    var pluginAccessToken = null;
    var pluginRefreshToken = null;
    var proxyEndpoint = null;
    
    var adminUser = null;
    var user = null;
    var inactiveUser = null;

    var defaultAccessTokenLifeTime = 1800000;
    var defaultRefreshTokenLifeTime = 15724800000;

    before(function (done) {

        function createAdminUser(callback) {
            utils.createUser2(0, void 0, function (err, result) {
                if (err) {
                    return callback(err);
                }

                adminUser = result.user;
                callback();
            });
        }

        function createUser(callback) {
            utils.createUser2(1, void 0, function (err, result) {
                if (err) {
                    return callback(err);
                }

                user = result.user;
                callback();
            });
        }

        function createInactiveUser(callback) {
            utils.createUser3(1, void 0, 1, function (err, result) {
                if (err) {
                    return callback(err);
                }

                inactiveUser = result.user;
                callback();
            });
        }

        function createPlugin(callback) {
            var description = 'Plugin Description';
            var healthCheckUrl = 'http://healthcheck.com';
            
            var params = {
                jwt: utils.jwt.admin,
                data: {
                    name: PLUGIN,
                    description: description,
                    healthCheckUrl: healthCheckUrl
                }
            };
            params.query = path.query(
                'returnCommands', true,
                'returnUpdatedCommands', false,
                'returnNotifications', false
            );


            utils.createPlugin(path.PLUGIN_REGISTER, params, function (err, result) {
                if (err) {
                    return callback(err);
                }
                
                pluginProxyEndpoind = result.proxyEndpoint;
                pluginAccessToken = result.accessToken;
                pluginRefreshToken = result.refreshToken;
                
                callback()
            });
        }

        async.series([
            createAdminUser,
            createUser,
            createInactiveUser,
            createPlugin
        ], done);
    });

    describe('#Login', function() {
        it('should create token using basic authentication with valid credentials', function (done) {
            utils.createAuth(path.JWT, {data: {
                    login: utils.admin.login,
                    password: utils.admin.password
                }
            }, function (err, result) {
                if (err) {
                    return done(err);
                }

                assert(result.accessToken != null);
                assert(result.refreshToken != null);

                done();
            });
        });

        it('should create a token with admin permissions for an admin user', function (done) {
            utils.createAuth(path.JWT, {data: {
                    login: adminUser.login,
                    password: adminUser.password
                }
            }, function (err, result) {
                if (err) {
                    return done(err);
                }

                assert(result.accessToken != null);
                var jwtTokenVO = utils.parseJwt(result.accessToken);
                
                jwtTokenVO.payload.a.should.containEql(0);
                jwtTokenVO.payload.n.should.containEql('*');
                jwtTokenVO.payload.d.should.containEql('*');

                done();
            });
        });

        it('should create a token with client permissions for a client user', function (done) {
            utils.createAuth(path.JWT, {data: {
                    login: user.login,
                    password: user.password
                }
            }, function (err, result) {
                if (err) {
                    return done(err);
                }

                assert(result.accessToken != null);
                var jwtTokenVO = utils.parseJwt(result.accessToken);
                
                if (jwtTokenVO.payload.n.length > 0) {
                	jwtTokenVO.payload.d.should.containEql('*');
                }

                done();
            });
        });

        it('should return error when creating token using basic authentication with invalid credentials', function (done) {
            utils.createAuth(path.JWT, {data: {
                login: utils.admin.login,
                password: 1111
            }
            }, function (err) {
                assert.strictEqual(err.error, 'Invalid credentials');
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                done();
            });
        });
    });

    describe('#Create', function() {

        var jwt1 = null;
        var jwt2 = null;

        before(function (done) {
            var params = [
                {
                    user: user,
                    actions: 'ManageToken'
                },
                {
                    user: user
                }
            ];
            utils.jwt.createMany(params, function (err, result) {
                if (err) {
                    return done(err);
                }
                jwt1 = result[0];
                jwt2 = result[1];
                done();
            });
        });

        it('should create token with all permissions, networks and devices', function (done) {
            utils.createAuth(path.JWT + '/create', {jwt: utils.jwt.admin,
                data: {
                    userId: 1,
                    actions: ['*'],
                    networkIds: ['*'],
                    deviceIds: ['*']
                }
            }, function (err, result) {
                if (err) {
                    return done(err);
                }

                assert(result.accessToken != null);
                assert(result.refreshToken != null);

                done();
            });
        });

        it('should create token with custom expiration date', function (done) {
            utils.createAuth(path.JWT + '/create', {jwt: utils.jwt.admin,
                data: {
                    userId: 1,
                    actions: ['*'],
                    networkIds: ['*'],
                    deviceIds: ['*'],
                    expiration: "2018-01-01T00:00:00.000Z"
                }
            }, function (err, result) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(result.accessToken.includes('eyJhbGciOiJIUzI1NiJ9.eyJwYXlsb2FkIjp7ImUiOjE1MTQ3NjQ4MDAwMDAsInQiOjEsInUiOjEsImEiOlswXSwibiI6WyIqIl0sImQiOlsiKiJdfX0.ztPbZex2ZXYHPetsz_zVimTfI3oy5xGbCBEgdcateCc'),
                    true, 'Access token is not correct');
                assert.strictEqual(result.refreshToken.includes('eyJhbGciOiJIUzI1NiJ9.eyJwYXlsb2FkIjp7ImUiOjE1MTQ3NjQ4MDAwMDAsInQiOjAsInUiOjEsImEiOlswXSwibiI6WyIqIl0sImQiOlsiKiJdfX0.M-bMPxE6Powju-eKULkAIKhroWn88XeBrILrIFDOIxg'),
                    true, 'Refresh token is not correct');

                done();
            });
        });

        it('should create access token without provided expiration date', function (done) {
            utils.createAuth(path.JWT + '/create', {jwt: utils.jwt.admin,
                data: {
                    userId: 1,
                    actions: ['*'],
                    networkIds: ['*'],
                    deviceIds: ['*']
                }
            }, function (err, result) {
                if (err) {
                    return done(err);
                }

                assert(result.accessToken != null);
                assert(result.refreshToken != null);

                var accessTokenVO = utils.parseJwt(result.accessToken);
                var refreshTokenVO = utils.parseJwt(result.refreshToken);
                var expAccessTime = new Date().getTime() + defaultAccessTokenLifeTime;
                var expRefreshTime = new Date().getTime() + defaultRefreshTokenLifeTime;

                assert(accessTokenVO.payload.e - expAccessTime < 1000);
                assert(refreshTokenVO.payload.e - expRefreshTime < 1000);

                done();
            });
        });

        it('should refresh access token without provided expiration date', function (done) {
            utils.createAuth(path.JWT + '/refresh', {
                data: {
                    refreshToken: utils.jwt.admin_refresh

            }}, function (err, result) {
                if (err) {
                    return done(err);
                }

                assert(result.accessToken != null);

                var accessTokenVO = utils.parseJwt(result.accessToken);
                var expTime = new Date().getTime() + defaultAccessTokenLifeTime;

                assert(accessTokenVO.payload.e - expTime < 1000);

                done();
            });
        });

        it('should return error when creating token with refresh jwt', function (done) {
            utils.createAuth(path.JWT + '/create', {jwt: utils.jwt.admin_refresh,
                data: {
                    userId: 1,
                    actions: ['*'],
                    networkIds: ['*'],
                    deviceIds: ['*']
                }
            }, function (err) {
                assert.strictEqual(err.error, 'Unauthorized');
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                done();
            });
        });

        it('should create token with ManageToken permission', function (done) {
            utils.createAuth(path.JWT + '/create', {jwt: jwt1,
                data: {
                    userId: 1,
                    actions: ['*'],
                    networkIds: ['*'],
                    deviceIds: ['*']
                }
            }, function (err, result) {
                if (err) {
                    return done(err);
                }

                assert(result.accessToken != null);
                assert(result.refreshToken != null);

                done();
            });
        });

        it('should not create token without ManageToken permission', function(done){
            utils.createAuth(path.JWT + '/create', {jwt: jwt2,
                data: {
                    userId: 1,
                    actions: ['*'],
                    networkIds: ['*'],
                    deviceIds: ['*']
                }
            }, function (err, result) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Access is denied');
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);
                done();
            });
        });

        it('should not create token for invalid User', function (done) {
            var invalidUserId = utils.NON_EXISTING_ID;
            utils.createAuth(path.JWT + '/create', {jwt: utils.jwt.admin,
                data: {
                    userId: invalidUserId,
                    actions: ['*'],
                    networkIds: ['*'],
                    deviceIds: ['*']
                }
            }, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, format('User with id = %d not found', invalidUserId));
                assert.strictEqual(err.httpStatus, status.NOT_FOUND);
                done();
            });
        });

        it('should not create token with error User is not active', function (done) {
            utils.createAuth(path.JWT + '/create', {jwt: utils.jwt.admin,
                data: {
                    userId: inactiveUser.id,
                    actions: ['*'],
                    networkIds: ['*'],
                    deviceIds: ['*']
                }
            }, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'User is locked or disabled');
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);
                done();
            });

        });
    });

    describe('#Refresh', function() {

        var refresh1 = null;
        var refresh2 = null;

        before(function (done) {
            var params = [
                {
                    user: user
                }
            ];
            utils.jwt.createManyRefresh(params, function (err, result) {
                if (err) {
                    return done(err);
                }
                refresh1 = result[0];
                refresh2 = result[1];
                done();
            });
        });

        it('should not refresh token with error refresh token is not valid', function (done) {
            utils.createAuth(path.JWT + '/refresh', {
                data: {
                    refreshToken: utils.jwt.admin_refresh_invalid
                }
            }, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Invalid token type');
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                done();
            });
        });

        it('should not refresh token with error refresh token has expired', function (done) {
            utils.createAuth(path.JWT + '/refresh', {
                data: {
                    refreshToken: utils.jwt.admin_refresh_exp
                }
            }, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Token has expired');
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                done();
            });
        });
        
        it('should not refresh token with error refresh token has invalid signature', function (done) {
            utils.createAuth(path.JWT + '/refresh', {
                data: {
                    refreshToken: utils.jwt.admin_refresh_invalid_signature
                }
            }, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Unauthorized');
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                done();
            });
        });
    });

    describe('#plugin/authenticate', function() {
        
        it('should not authenticate with invalid token', function (done) {
            var params = {};

            params.query = path.query(
                'token', 'token'
            );
            
            utils.getAuth(path.JWT + '/plugin/authenticate', params, function(err) {
                assert.strictEqual(err.error, 'Token is not valid');
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);

                done();
            });
        });

        it('should not authenticate with empty tonen', function (done) {
            var params = {};

            params.query = null;
            
            utils.getAuth(path.JWT + '/plugin/authenticate', params, function(err) {
                assert.strictEqual(err.error, 'Token is empty');
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);

                done();
            });
        });

        it('should not authenticate with refresh plugin token', function (done) {
            var params = {};

            params.query = path.query(
                'token', pluginRefreshToken
            );

            utils.getAuth(path.JWT + '/plugin/authenticate', params, function(err) {
                assert.strictEqual(err.error, 'Invalid token type');
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);

                done();
            });
        });
        
        it('should authenticate with access plugin token', function (done) {
            var params = {};

            params.query = path.query(
                'token', pluginAccessToken
            );

            utils.getAuth(path.JWT + '/plugin/authenticate', params, function(err, result) {
                if (err) {
                    done(err);
                }
                utils.hasPropsWithValues(result, ['tpc', 'e', 't']);
                assert.strictEqual(result.t, 1, "Wrong token type!")

                done();
            });
        });

    });

    describe('#plugin/create', function() {
        var payload = null;

        before(function (done) {
            var params = {};

            params.query = path.query(
                'token', pluginAccessToken
            );

            utils.getAuth(path.JWT + '/plugin/authenticate', params, function(err, result) {
                payload = result;
                
                done();
            });
        });

        it('should create access and refresh plugin tokens with correct payload', function (done) {
            
            utils.createAuth(path.JWT + '/plugin/create', {jwt: utils.jwt.admin, data: payload}, function (err, result) {
                if (err) {
                    done(err);
                }

                assert(result.accessToken != null);
                assert(result.refreshToken != null);

                done();
            });
            
        });

        it('should not create access and refresh plugin tokens with empty payload', function (done) {

            utils.createAuth(path.JWT + '/plugin/create', {jwt: utils.jwt.admin, data: {}}, function (err, result) {
                assert.strictEqual(err.error, 'No permisions or invalid topic name');
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);

                done();
            });

        });

        it('should not create access and refresh plugin tokens with invalid topic name payload', function (done) {

            utils.createAuth(path.JWT + '/plugin/create', {jwt: utils.jwt.admin, data: {"tpc": "no_topic"}}, function (err, result) {
                assert.strictEqual(err.error, 'No permisions or invalid topic name');
                assert.strictEqual(err.httpStatus, status.FORBIDDEN);

                done();
            });

        });

        it('should create plugin token with custom expiration date', function (done) {
            var expiration = "2018-01-01T00:00:00.000";
            utils.createAuth(path.JWT + '/plugin/create', {jwt: utils.jwt.admin,
                data: {
                    tpc: payload.tpc,
                    e: expiration
                }
            }, function (err, result) {
                var params = {};

                params.query = path.query(
                    'token', result.accessToken
                );
                
                utils.getAuth(path.JWT + '/plugin/authenticate', params, function(err, result) {
                    if (err) {
                        done(err);
                    }

                    assert.strictEqual(result.e, expiration, "Wrong expiration!");
                    done();
                });
            });
        });

        it('should create access token for plugin without provided expiration date', function (done) {

            var expiration = "2018-01-01T00:00:00.000";
            utils.createAuth(path.JWT + '/plugin/create', {jwt: utils.jwt.admin,
                data: {
                    tpc: payload.tpc,
                    e: expiration
                }
            }, function (err, result) {
                var params = {};

                params.query = path.query(
                    'token', result.accessToken
                );

                utils.getAuth(path.JWT + '/plugin/authenticate', params, function(err, result) {
                    if (err) {
                        done(err);
                    }

                    assert.strictEqual(result.e, expiration, "Wrong expiration!");
                    done();
                });
            });
            
            utils.createAuth(path.JWT + '/plugin/create', {jwt: utils.jwt.admin,
                data: {
                    tpc: payload.tpc,
                }
            }, function (err, result) {
                if (err) {
                    return done(err);
                }

                assert(result.accessToken != null);
                assert(result.refreshToken != null);

                var accessTokenVO = utils.parseJwt(result.accessToken);
                var refreshTokenVO = utils.parseJwt(result.refreshToken);
                var expAccessTime = new Date().getTime() + defaultAccessTokenLifeTime;
                var expRefreshTime = new Date().getTime() + defaultRefreshTokenLifeTime;

                assert(accessTokenVO.payload.e - expAccessTime < 1000);
                assert(refreshTokenVO.payload.e - expRefreshTime < 1000);

                done();
            });
        });

        it('should return error when creating token with refresh jwt', function (done) {
            utils.createAuth(path.JWT + '/plugin/create', {jwt: utils.jwt.admin_refresh,
                data: {
                    tpc: payload.tpc,
                }
            }, function (err) {
                assert.strictEqual(err.error, 'Unauthorized');
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                done();
            });
        });

    });

    describe('#plugin/refresh', function() {
        var payload = null;

        before(function (done) {
            var params = {};

            params.query = path.query(
                'token', pluginAccessToken
            );

            utils.getAuth(path.JWT + '/plugin/authenticate', params, function(err, result) {
                payload = result;

                done();
            });
        });

        it('should not refresh token with error user refresh token', function (done) {
            utils.createAuth(path.JWT + '/refresh', {
                data: {
                    refreshToken: utils.jwt.admin_refresh_invalid
                }
            }, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Invalid token type');
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                done();
            });
        });

        it('should not refresh token with error plugin refresh token', function (done) {
            utils.createAuth(path.JWT + '/refresh', {
                data: {
                    refreshToken: utils.jwt.plugin_refresh_invalid
                }
            }, function (err) {
                assert.strictEqual(!(!err), true, 'Error object created');
                assert.strictEqual(err.error, 'Plugin is not found');
                assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                done();
            });
        });

        it('should not refresh token with error refresh token has expired', function (done) {
            var expiration = "2017-01-01T00:00:00.000";
            utils.createAuth(path.JWT + '/plugin/create', {jwt: utils.jwt.admin,
                data: {
                    tpc: payload.tpc,
                    e: expiration
                }
            }, function (err, result) {
                utils.createAuth(path.JWT + '/refresh', {
                    data: {
                        refreshToken: result.refreshToken
                    }
                }, function (err) {
                    assert.strictEqual(!(!err), true, 'Error object created');
                    assert.strictEqual(err.error, 'Token has expired');
                    assert.strictEqual(err.httpStatus, status.NOT_AUTHORIZED);
                    done();
                });
            });
        });

    });
    
    after(function (done) {
        utils.clearDataJWT(done);
    });
});
