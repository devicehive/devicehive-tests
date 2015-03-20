var assert = require('assert');
var async = require('async');
var format = require('util').format;
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;
var req = require('./common/request');

describe('REST API OAuth Grant', function () {
    this.timeout(30000);

    var user = null;
    var client = {
        name: utils.getName('oauth-grant'),
        oauthId: '_oauth-oauth-grant-id',
        domain: '_domain-oauth-grant.com',
        redirectUri: '_domain-oauth-grant.com',
        subnet: '127.0.0.0/24'
    };

    before(function (done) {
        utils.clearOldEntities(function () {
            init(done);
        });
    });

    function init(done) {

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
    }

    describe('#Get All', function () {

        var anotherClient = {
            name: utils.getName('oauth-grant-another'),
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
            redirectUri: '_domain-oauth-grant-3.com',
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

    describe('#Create', function () {
        var grant = {
            client: { oauthId: client.oauthId },
            type: 'Code',
            redirectUri: '_domain-oauth-grant-4.com',
            scope: 'GetNetwork',
            networkIds: [1, 2]
        };
        var createResult = null;

        before(function (done) {
            req.create(path.current)
                .params({user: user, data: grant})
                .send(function (err, result) {
                    if (err) {
                        return done(err);
                    }
                    grant.id = result.id;
                    createResult = result;
                    done();
                });
        });

        it('should contain auth code in response, but no access key', function () {
            assert.strictEqual(!(!createResult.authCode), true, 'Auth code provided as part of response');
            assert.strictEqual(!(!createResult.accessKey), false, 'Access key is not exposed in the Code type');
        });

        it('should verify grant returned', function (done) {
            req.get(path.current)
                .params({user: user, id: grant.id})
                .expectTrue(function (result) {
                    return utils.core.hasStringValue(result.timestamp);
                })
                .expect(grant)
                .expect({client: client})
                .send(done);
        });

        it('should verify access key returned', function (done) {
            req.get(path.current)
                .params({user: user, id: grant.id})
                .expectTrue(function (result) {
                    return utils.core.hasStringValue(result.accessKey.key) &&
                        utils.core.hasStringValue(result.accessKey.expirationDate);
                })
                .expect({
                    accessKey: {
                        label: 'OAuth token for: ' + client.name,
                        permissions: [{
                            domains: ['_domain-oauth-grant.com'],
                            subnets: ['127.0.0.0/24'],
                            actions: ['GetNetwork'],
                            networkIds: [1, 2]
                        }]
                    }
                })
                .send(done);
        });
    });

    describe('#Create Implicit', function () {
        var grant = {
            client: { oauthId: client.oauthId },
            type: 'Token',
            redirectUri: '_domain-oauth-grant-5.com',
            scope: 'GetNetwork',
            accessType: 'Offline'
        };

        it('should create grant with \'Token\' type and return access key', function (done) {
            req.create(path.current)
                .params({user: user, data: grant})
                .send(function (err, result) {
                    if (err) {
                        return done(err);
                    }
                    assert.strictEqual(!(!result.authCode), false,
                        'Auth code is not provided as part of response');
                    assert.strictEqual(!(!result.accessKey), true,
                        'Access key is exposed in the Token type');
                    assert.strictEqual(utils.core.hasStringValue(result.accessKey.key), true,
                        'Access key is provided in the property');
                    assert.strictEqual(!(!result.accessKey.expirationDate), false,
                        'Exp date should be null for the Offline access type');
                    done();
                });
        });
    });

    describe('#Update', function () {
        var grant = {
            client: { oauthId: client.oauthId },
            type: 'Code',
            redirectUri: '_domain-oauth-grant-6.com',
            scope: 'GetNetwork'
        };
        var created = null;

        before(function (done) {
            req.create(path.current)
                .params({user: user, data: grant})
                .send(function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    grant.id = result.id;
                    req.get(path.current)
                        .params({user: user, id: grant.id})
                        .send(function (err, result) {
                            if (err) {
                                return done(err);
                            }
                            created = result;
                            done();
                        })
                });
        });

        it('should update the grant', function (done) {
            var update = {
                scope: 'GetDevice',
                networkIds: [2, 3]
            };
            req.update(path.current)
                .params({user: user, id: grant.id, data: update})
                .expectTrue(function (result) {
                    return utils.core.hasStringValue(result.authCode);
                })
                .expectFalse(function (result) {
                    return !(!result.accessKey);
                })
                .send(done);
        });

        it('should check the grant and associated access key were updated', function (done) {
            var update = {
                scope: 'GetDevice',
                networkIds: [2, 3]
            };
            req.update(path.current)
                .params({user: user, id: grant.id, data: update})
                .send(function (err) {
                    if (err) {
                        return done(err);
                    }

                    req.get(path.current)
                        .params({user: user, id: grant.id})
                        .expect({
                            accessKey: {
                                id: created.accessKey.id,
                                permissions: [{
                                    domains: ['_domain-oauth-grant.com'],
                                    subnets: ['127.0.0.0/24'],
                                    actions: [update.scope],
                                    networkIds: update.networkIds
                                }]
                            }
                        })
                        .expectTrue(function (result) {
                            return result.timestamp !== created.timestamp;
                        })
                        .expectTrue(function (result) {
                            return result.authCode !== created.authCode;
                        })
                        .expectTrue(function (result) {
                            return result.accessKey.key !== created.accessKey.key;
                        })
                        .expectTrue(function (result) {
                            return result.accessKey.expirationDate !== created.accessKey.expirationDate;
                        })
                        .send(done);
                });
        });
    });

    describe('#Update Implicit', function () {
        var grant = {
            client: { oauthId: client.oauthId },
            type: 'Token',
            redirectUri: '_domain-oauth-grant-7.com',
            scope: 'GetNetwork',
            accessType: 'Offline'
        };
        var created = null;

        before(function (done) {
            req.create(path.current)
                .params({user: user, data: grant})
                .send(function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    grant.id = result.id;
                    req.get(path.current)
                        .params({user: user, id: grant.id})
                        .send(function (err, result) {
                            if (err) {
                                return done(err);
                            }
                            created = result;
                            done();
                        })
                });
        });

        it('should update the grant', function (done) {
            var update = {
                scope: 'GetDevice',
                networkIds: [3, 4]
            };
            req.update(path.current)
                .params({user: user, id: grant.id, data: update})
                .expectFalse(function (result) {
                    return !(!result.authCode);
                })
                .expect({ accessKey: { id: created.accessKey.id } })
                .expectTrue(function (result) {
                    return result.accessKey.key !== created.accessKey.key;
                })
                .send(function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    req.get(path.current)
                        .params({user: user, id: grant.id})
                        .expect({
                            accessKey: {
                                id: created.accessKey.id,
                                permissions: [{
                                    domains: ['_domain-oauth-grant.com'],
                                    subnets: ['127.0.0.0/24'],
                                    actions: [update.scope],
                                    networkIds: update.networkIds
                                }]
                            }
                        })
                        .expectFalse(function (result) {
                            return !(!result.accessKey.expirationDate);
                        })
                        .send(done);
                });
        });
    });

    describe('#Delete', function () {

        var grant = {
            client: { oauthId: client.oauthId },
            type: 'Token',
            redirectUri: '_domain-oauth-grant-8.com',
            scope: 'GetNetwork'
        };
        var accessKeyId = null;

        before(function (done) {
            req.create(path.current)
                .params({user: user, data: grant})
                .send(function (err, result) {
                    if (err) {
                        return done(err);
                    }

                    grant.id = result.id;
                    req.get(path.current)
                        .params({user: user, id: grant.id})
                        .send(function (err, result) {
                            if (err) {
                                return done(err);
                            }
                            accessKeyId = result.accessKey.id;
                            done();
                        })
                });
        });

        it('should delete grant', function (done) {
            req.delete(path.current)
                .params({user: user, id: grant.id})
                .send(function (err) {
                    if (err) {
                        return done(err);
                    }

                    req.get(path.current)
                        .params({user: user, id: grant.id})
                        .expectError(status.NOT_FOUND, format('Grant with id = %s not found', grant.id))
                        .send(function (err) {
                            if (err) {
                                return done(err);
                            }

                            // Should also delete access key
                            req.get(path.combine(path.USER, user.id, 'accesskey', accessKeyId))
                                .params({user: user, id: grant.id})
                                .expectError(status.NOT_FOUND, format('HTTP 404 Not Found'))
                                .send(done);
                        });
                });
        });
    });

    describe('#Bad Request', function () {
        it('should fail with 400 when specifying invalid keys in request', function (done) {
            req.create(path.current)
                .params({
                    user: user,
                    data: { invalidProp: utils.getName('client-invalid') }
                })
                .expectError(status.BAD_REQUEST)
                .send(done);
        });
    });

    describe('#Not Authorized', function () {
        describe('#No Authorization', function () {
            it('should fail with 401 if auth parameters omitted', function (done) {
                req.get(path.current)
                    .params({user: null})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when selecting grant by id, auth parameters omitted', function (done) {
                req.get(path.current)
                    .params({user: null, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when creating grant with no auth parameters', function (done) {
                req.create(path.current)
                    .params({user: null, data: {name: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when updating grant with no auth parameters', function (done) {
                req.update(path.current)
                    .params({user: null, id: utils.NON_EXISTING_ID, data: {name: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when deleting grant with no auth parameters', function (done) {
                req.delete(path.current)
                    .params({user: null, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });
        });

        describe('#User Authorization', function () {

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

            it('should fail with 401 when selecting grants with invalid user', function (done) {
                req.get(path.current)
                    .params({user: nonNetworkUser})
                    //.expectError(status.NOT_AUTHORIZED, 'Not authorized') // TODO: Unauthorized/Not authorized
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when getting grant with invalid user', function (done) {
                req.get(path.current)
                    .params({user: nonNetworkUser, id: utils.NON_EXISTING_ID})
                    //.expectError(status.NOT_AUTHORIZED, 'Not authorized') // TODO: Unauthorized/Not authorized
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when creating grant with invalid user', function (done) {
                req.create(path.current)
                    .params({user: nonNetworkUser, data: {name: 'not-authorized'}})
                    //.expectError(status.NOT_AUTHORIZED, 'Not authorized') // TODO: Unauthorized/Not authorized
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when updating grant with invalid user', function (done) {
                req.update(path.current)
                    .params({user: nonNetworkUser, id: utils.NON_EXISTING_ID, data: {name: 'not-authorized'}})
                    //.expectError(status.NOT_AUTHORIZED, 'Not authorized') // TODO: Unauthorized/Not authorized
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            });

            it('should fail with 401 when deleting grant with invalid user', function (done) {
                req.delete(path.current)
                    .params({user: nonNetworkUser, id: utils.NON_EXISTING_ID})
                    //.expectError(status.NOT_AUTHORIZED, 'Not authorized') // TODO: Unauthorized/Not authorized
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
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

            it('should fail with 401 when getting list using invalid access key', function (done) {
                req.get(path.current)
                    .params({accessKey: accessKey})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when selecting grant by id using invalid access key', function (done) {
                req.get(path.current)
                    .params({accessKey: accessKey, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when creating grant using invalid access key', function (done) {
                req.create(path.current)
                    .params({accessKey: accessKey, data: {name: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when updating grant using invalid access key', function (done) {
                req.update(path.current)
                    .params({accessKey: accessKey, id: utils.NON_EXISTING_ID, data: {name: 'not-authorized'}})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });

            it('should fail with 401 when deleting grant with no auth parameters', function (done) {
                req.delete(path.current)
                    .params({accessKey: accessKey, id: utils.NON_EXISTING_ID})
                    .expectError(status.NOT_AUTHORIZED, 'Not authorized')
                    .send(done);
            });
        });
    });

    describe('#Not Found', function () {

        it('should fail with 404 when selecting grant by non-existing id', function (done) {
            req.get(path.current)
                .params({user: utils.admin, id: utils.NON_EXISTING_ID})
                .expectError(status.NOT_FOUND, format('Grant with id = %s not found', utils.NON_EXISTING_ID))
                .send(done);
        });

        it('should fail with 404 when updating grant by non-existing id', function (done) {
            req.update(path.current)
                .params({user: utils.admin, id: utils.NON_EXISTING_ID})
                .expectError(status.NOT_FOUND, format('Grant with id = %s not found', utils.NON_EXISTING_ID))
                .send(done);
        });

        it('should succeed when deleting grant by non-existing id', function (done) {
            req.delete(path.current)
                .params({user: utils.admin, id: utils.NON_EXISTING_ID})
                .send(done);
        });
    });

    after(function (done) {
        utils.clearResources(done);
    });
});
