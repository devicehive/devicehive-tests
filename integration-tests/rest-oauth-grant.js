var async = require('async');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;
var req = require('./common/request');

describe('REST API OAuth Grant', function () {

    var user = null;
    var client = {
        name: '_integr-tests-oauth-grant',
        oauthId: '_oauth-oauth-grant-id',
        domain: '_domain-oauth-grant.com',
        redirectUri: '_domain-oauth-grant.com',
        subnet: '127.0.0.0/24'
    };

    before(function (done) {

        function createUser(callback) {
            utils.createUser2(1, void 0,
                function (err, result) {
                    if (err) {
                        return callback(err);
                    }

                    user = result.user;
                    path.current = path.combine(path.USER, user.id, 'oauth', 'grant');
                    callback();
                })
        }

        function createClient(callback) {
            req.create(path.combine('/', 'oauth', 'client'))
                .params({user: utils.admin, data: client})
                .send(function (err, result) {
                    if (err) {
                        callback(err);
                    }

                    client.id = result.id;
                    callback();
                });
        }

        async.series([
            createUser,
            createClient
        ], done);
    });

    describe('#Get All', function () {

        var anotherClient = {
            name: '_integr-tests-oauth-grant-another',
            oauthId: '_oauth-oauth-grant-another-id',
            domain: '_domain-oauth-grant-another.com',
            redirectUri: '_domain-oauth-grant-another.com'
        };
        var grant1 = {
            client: { oauthId: client.oauthId },
            type: 'Code',
            accessType: 'Offline',
            redirectUri: '_domain-oauth-grant-1.com',
            scope: 'GetNetwork',
            networkIds: [1, 2]
        };
        var grant2 = {
            client: { oauthId: anotherClient.oauthId },
            type: 'Token',
            accessType: 'Online',
            redirectUri: '_domain-oauth-grant-2.com',
            scope: 'GetDevice',
            networkIds: [2, 3]
        };

        before(function (done) {

            function createClient(callback) {
                req.create(path.combine('/', 'oauth', 'client'))
                    .params({user: utils.admin, data: anotherClient})
                    .send(function (err, result) {
                        if (err) {
                            callback(err);
                        }

                        anotherClient.id = result.id;
                        callback();
                    });
            }

            function createGrants(callback) {
                var results = [];
                async.eachSeries([grant1, grant2], function (grant, cb) {
                    req.create(path.current)
                        .params({user: utils.admin, data: grant})
                        .send(function (err, result) {
                            results.push(result);
                            cb(err);
                        });
                }, function (err) {
                    if (err) {
                        return callback(err);
                    }
                    grant1.id = results[0].id;
                    grant2.id = results[1].id;
                    callback();
                })
            }

            async.series([
                createClient,
                createGrants
            ], done);
        });

        it('should get all grants', function (done) {
            req.get(path.current)
                .params({user: user})
                .expect([grant1, grant2])
                .send(done);
        });

        it('should get grant by client OAuth id', function (done) {
            req.get(path.current)
                .params({user: user})
                .query('clientOAuthId', grant1.client.oauthId)
                .expectTrue(function (result) {
                    return utils.core.isArrayOfLength(result, 1);
                })
                .expect([grant1])
                .send(done);
        });

        it('should get grant by scope', function (done) {
            req.get(path.current)
                .params({user: user})
                .query('scope', grant2.scope)
                .expectTrue(function (result) {
                    return utils.core.isArrayOfLength(result, 1);
                })
                .expect([grant2])
                .send(done);
        });

        it('should get grant by redirectUri', function (done) {
            req.get(path.current)
                .params({user: user})
                .query('redirectUri', grant2.redirectUri)
                .expectTrue(function (result) {
                    return utils.core.isArrayOfLength(result, 1);
                })
                .expect([grant2])
                .send(done);
        });
    });

    describe('#Get', function () {
        var grant = {
            client: { oauthId: client.oauthId },
            type: 'Code',
            redirectUri: '_domain-oauth-grant-2.com',
            scope: 'GetNetwork'
        };

        before(function (done) {
            req.create(path.current)
                .params({user: user, data: grant})
                .send(function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    grant.id = result.id;
                    done();
                });
        });

        it('should get grant with user auth', function (done) {
            req.get(path.current)
                .params({user: user, id: grant.id})
                .expect(grant)
                .send(done);
        });

        it('should get grant with admin auth', function (done) {
            req.get(path.current)
                .params({user: user, id: grant.id})
                .expect(grant)
                .send(done);
        });
    });

    describe('#', function () {
        //it.only('should ', function (done) {
        //    req.get(path.current)
        //        .params()
        //        .expectError()
        //        .expect()
        //        .expectTrue(function (result) {
        //            //return ;
        //        })
        //        .send(done);
        //});
    });

    after(function (done) {
        utils.clearResources(done);
    });
});
