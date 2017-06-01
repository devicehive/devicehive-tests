var async = require('async');
var utils = require('./common/utils');
var path = require('./common/path');
var status = require('./common/http').status;
var req = require('./common/request');

describe('REST API Configuration', function () {
    this.timeout(90000);

    before(function () {
        path.current = path.CONFIGURATION;
    });

    describe('#Get', function () {
        var propertyId = 'jwt.secret';

        it('should get jwt.secret', function (done) {
            req.get(path.current)
                .params({
                    id: propertyId,
                    jwt: utils.jwt.admin
                })
                .expect({
                    "name": "jwt.secret",
                    "value": "devicehive"
                })
                .send(done);
        });
    });

    describe('#Update', function () {

        var propertyId = "test_property_create";
        var propertyValue = "test_value_create";

        it('should create configuration', function (done) {
            req.update(path.current)
                .params({
                    id: propertyId,
                    jwt: utils.jwt.admin,
                    data: propertyValue
                })
                .expect({
                    "name": "test_property_create",
                    "value": "\"test_value_create\""
                })
                .send(done);
        });

        after(function (done) {
            utils.delete(path.current, {
                id: propertyId,
                jwt: utils.jwt.admin
            }, function () {
                done();
            });
        });
    });

    describe('#Delete', function () {
        var propertyId = "test_property_delete";

        before(function (done) {
            utils.update(path.current, {
                id: propertyId,
                jwt: utils.jwt.admin
            }, function () {
                done();
            });
        });

        it('should delete configuration', function(done){
            req.delete(path.current)
                .params({
                    id: propertyId,
                    jwt: utils.jwt.admin
                })
                .expect(status.EXPECTED_DELETED)
                .send(done);
        });
    });

    // Some of tests could be pending due to allowing anonymous user creation in java-server configuration
    describe('#Unauthorized', function () {
        var propertyId = 'jwt.secret';
        var nonPropertyId = 'jwt.not-a-secret';
        var propertyValue = "test_value_delete";

        it('should fail with 401 if auth parameters omitted', function (done) {
            req.get(path.current)
                .params({
                    id: propertyId,
                    jwt: null
                })
                .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                .send(done);
        });

        it('should fail with 401 when selecting configuration by not existing id, no auth parameters, no data',
            function (done) {
                req.get(path.current)
                    .params({jwt: null, id: nonPropertyId})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            }
        );

        it('should fail with 401 when updating configuration by not existing id, no auth parameters',
            function (done) {
                req.update(path.current)
                    .params({jwt: null, id: nonPropertyId, data: propertyValue})
                    .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                    .send(done);
            }
        );

        it('should fail with 401 when deleting configuration with no auth parameters', function (done) {
            req.delete(path.current)
                .params({jwt: null, id: nonPropertyId})
                .expectError(status.NOT_AUTHORIZED, 'Unauthorized')
                .send(done);
        });
    });

    describe('#Not Found', function () {
        var nonPropertyId = 'jwt.not-a-secret';

        it('should fail with 404 when selecting user by non-existing id', function (done) {
            req.get(path.current)
                .params({jwt: utils.jwt.admin, id: nonPropertyId})
                .expectError(status.NOT_FOUND)
                .send(done);
        });

        it('should succeed when deleting user by non-existing id', function (done) {
            req.delete(path.current)
                .params({jwt: utils.jwt.admin, id: nonPropertyId})
                .send(done);
        });
    });


});
