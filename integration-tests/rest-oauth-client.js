var async = require('async');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;
var req = require('./common/request');

describe('REST API OAuth Client', function () {

    before(function (done) {
        utils.clearOldEntities(function () {
            init(done);
        });
    });

    function init(done) {
        path.current = path.combine('/', 'oauth', 'client');
        done();
    }

    describe('#Get All', function () {

        var client1 = {
            name: utils.getName('client-1'),
            oauthId: '_oauth-id-1',
            domain: '_domain-1.com',
            redirectUri: '_domain-1.com'
        };
        var client2 = {
            name: utils.getName('client-2'),
            oauthId: '_oauth-id-2',
            domain: '_domain-2.com',
            redirectUri: '_domain-2.com'
        };
        var oauthSecret1 = null;
        var oauthSecret2 = null;

        before(function (done) {
            var results = [];
            async.eachSeries([client1, client2], function (client, callback) {
                req.create(path.current)
                    .params({user: utils.admin, data: client})
                    .send(function (err, result) {
                        results.push(result);
                        callback(err);
                    });
            }, function (err) {
                if (err) {
                    return done(err);
                }
                client1.id = results[0].id;
                oauthSecret1 = results[0].oauthSecret;

                client2.id = results[1].id;
                oauthSecret2 = results[1].oauthSecret;

                done();
            })
        });

        it('should get all clients', function (done) {
            req.get(path.current)
                .params({})
                .expect([client1, client2])
                .send(done);
        });

        it('should get all clients, admin access', function (done) {
            req.get(path.current)
                .params({user: utils.admin})
                .expect([{oauthSecret: oauthSecret1}, {oauthSecret: oauthSecret2}])
                .expect([client1, client2])
                .send(done);
        });

        it('should get client by name', function (done) {
            req.get(path.current)
                .query('name', client1.name)
                .expect([client1])
                .send(done);
        });

        it('should get client by OAuth ID', function (done) {
            req.get(path.current)
                .query('oauthId', client2.oauthId)
                .expect([client2])
                .send(done);
        });

        it('should get client by domain', function (done) {
            req.get(path.current)
                .query('domain', client1.domain)
                .expect([client1])
                .send(done);
        });
    });

    describe('#Get', function () {

        var client = {
            name: utils.getName('client-3'),
            oauthId: '_oauth-id-3',
            domain: '_domain-3.com',
            redirectUri: '_domain-3.com'
        };

        before(function (done) {
            req.create(path.current)
                .params({user: utils.admin, data: client})
                .send(function (err, result) {
                    if (err) {
                        return done(err);
                    }
                    client.id = result.id;
                    done();
                });
        });

        it('should get client by id', function (done) {
            req.get(path.current)
                .params({id: client.id})
                .expect(client)
                .send(done);
        });
    });

    describe('#Create', function () {

        var client = {
            name: utils.getName('client-4'),
            oauthId: '_oauth-id-4',
            domain: '_domain-4.com',
            redirectUri: '_domain-4.com'
        };

        it('should create client', function (done) {
            req.create(path.current)
                .params({user: utils.admin, data: client})
                .send(function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    client.id = result.id;
                    req.get(path.current)
                        .params({id: client.id})
                        .expect(client)
                        .send(done);
                });
        });
    });

    describe('#Create Existing', function () {

        var client = {
            name: utils.getName('client-5'),
            oauthId: '_oauth-id-5',
            domain: '_domain-5.com',
            redirectUri: '_domain-5.com'
        };

        before(function (done) {
            req.create(path.current)
                .params({user: utils.admin, data: client})
                .send(function (err, result) {
                    if (err) {
                        return done(err);
                    }
                    client.id = result.id;
                    done();
                });
        });

        it('should fail with 403 when creating existing OAuth client', function (done) {

            var client = {
                name: utils.getName('client-5-other'),
                oauthId: '_oauth-id-5', // same
                domain: '_domain-5-other.com',
                redirectUri: '_domain-5-other.com'
            };

            req.create(path.current)
                .params({user: utils.admin, data: client})
                .expectError(status.FORBIDDEN, 'OAuth client with such OAuthID already exists!')
                .send(done);
        });
    });

    describe('#Update', function () {

        var client = {
            name: utils.getName('client-6'),
            oauthId: '_oauth-id-6',
            domain: '_domain-6.com',
            redirectUri: '_domain-6.com'
        };

        before(function (done) {
            req.create(path.current)
                .params({user: utils.admin, data: client})
                .send(function (err, result) {
                    if (err) {
                        return done(err);
                    }
                    client.id = result.id;
                    done();
                });
        });

        it('should update existing client', function (done) {
            var update = {
                name: utils.getName('client-6-update'),
                oauthId: '_oauth-id-6-update',
                domain: '_domain-6-update.com',
                redirectUri: '_domain-6-update.com'
            };
            req.update(path.current)
                .params({user: utils.admin, id: client.id, data: update})
                .send(function (err) {
                    if (err) {
                        return done(err);
                    }

                    req.get(path.current)
                        .params({id: client.id})
                        .expect(update)
                        .send(done);
                });
        });
    });

    describe('#Update Partial', function () {

        var client = {
            name: utils.getName('client-7'),
            oauthId: '_oauth-id-7',
            domain: '_domain-7.com',
            redirectUri: '_domain-7.com'
        };

        before(function (done) {
            req.create(path.current)
                .params({user: utils.admin, data: client})
                .send(function (err, result) {
                    if (err) {
                        return done(err);
                    }
                    client.id = result.id;
                    done();
                });
        });

        it('should partially update existing client', function (done) {
            var update = {subnet: '127.0.0.0/24'}
            req.update(path.current)
                .params({user: utils.admin, id: client.id, data: update})
                .send(function (err) {
                    if (err) {
                        return done(err);
                    }

                    req.get(path.current)
                        .params({id: client.id})
                        .expect(update)
                        .send(done);
                });
        });
    });

    describe('#Delete', function () {

        var client = {
            name: utils.getName('client-8'),
            oauthId: '_oauth-id-8',
            domain: '_domain-8.com',
            redirectUri: '_domain-8.com'
        };

        before(function (done) {
            req.create(path.current)
                .params({user: utils.admin, data: client})
                .send(function (err, result) {
                    if (err) {
                        return done(err);
                    }
                    client.id = result.id;
                    done();
                });
        });

        it('should delete client using admin authorization', function (done) {
            req.delete(path.current)
                .params({user: utils.admin, id: client.id})
                .send(function (err) {
                    if (err) {
                        return done(err);
                    }

                    req.get(path.current)
                        .params({id: client.id})
                        .expectError(status.NOT_FOUND, format('OAuthClient with id %s not found', client.id))
                        .send(done);
                });
        });
    });

    describe('#Bad Request', function () {
        it('should fail with 400 when specifying invalid keys in request', function (done) {
            req.create(path.current)
                .params({
                    user: utils.admin,
                    data: { invalidProp: utils.getName('client-invalid') }
                })
                .expectError(status.BAD_REQUEST)
                .send(done);
        });
    });

    describe('#Not Authorized', function () {

        var client = {
            name: utils.getName('fail'),
            oauthId: '_oauth-id-fail',
            domain: '_domain-fail.com',
            redirectUri: '_domain-fail.com'
        };

        describe('#No Authorization', function () {
            it('should fail with 401 when creating client with no auth parameters', function (done) {
                req.create(path.current)
                    .params({user: null, data: client})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when updating client with no auth parameters', function (done) {
                req.update(path.current)
                    .params({user: null, id: utils.NON_EXISTING_ID, data: client})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when deleting client with no auth parameters', function (done) {
                req.delete(path.current)
                    .params({user: null, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });
        });

        describe('#Client Authorization', function () {

            var nonNetworkUser = null;

            before(function (done) {
                utils.createUser2(1, void 0, function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    nonNetworkUser = result.user;
                    done();
                });
            });

            it('should fail with 401 when creating client with invalid user', function (done) {
                req.create(path.current)
                    .params({user: nonNetworkUser, data: client})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when updating client with invalid user', function (done) {
                req.update(path.current)
                    .params({user: nonNetworkUser, id: utils.NON_EXISTING_ID, data: client})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when deleting client with invalid user', function (done) {
                req.delete(path.current)
                    .params({user: nonNetworkUser, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });
        });

        describe('#Dummy Access Key Authorization', function () {

            var accessKey = null;

            before(function (done) {
                req.create(path.CURRENT_ACCESS_KEY)
                    .params(utils.accessKey.getParamsObj(utils.getName('user-dummy-access-key'), utils.admin, void 0, void 0, void 0, ['RegisterDevice']))
                    .send(function (err, result) {
                        if (err) {
                            return done(err);
                        }

                        accessKey = result.key;
                        done();
                    });
            });

            it('should fail with 401 when creating client using invalid access key', function (done) {
                req.create(path.current)
                    .params({accessKey: accessKey, data: client})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when updating client using invalid access key', function (done) {
                req.update(path.current)
                    .params({accessKey: accessKey, id: utils.NON_EXISTING_ID, data: client})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when deleting client with no auth parameters', function (done) {
                req.delete(path.current)
                    .params({accessKey: accessKey, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });
        });
    });

    describe('#Not Found', function () {
        it('should fail with 404 when selecting client by non-existing id', function (done) {
            req.get(path.current)
                .params({user: utils.admin, id: utils.NON_EXISTING_ID})
                .expectError(status.NOT_FOUND, format('OAuthClient with id %s not found', utils.NON_EXISTING_ID))
                .send(done);
        });

        it('should fail with 404 when updating client by non-existing id', function (done) {
            req.update(path.current)
                .params({user: utils.admin, id: utils.NON_EXISTING_ID})
                .expectError(status.NOT_FOUND, format('OAuth client with id = %s not found', utils.NON_EXISTING_ID))
                .send(done);
        });

        it('should succeed when deleting client by non-existing id', function (done) {
            req.delete(path.current)
                .params({user: utils.admin, id: utils.NON_EXISTING_ID})
                .send(done);
        });
    });

    after(function (done) {
        utils.clearResources(done);
    });
});
