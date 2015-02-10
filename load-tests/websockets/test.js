var log = require('../../common/log.js');

function Test() {
}

Test.mixin = function(destObject) {
    var props = Object.keys(Test.prototype);
    props.forEach(function (prop) {
        destObject.prototype[prop] = Test.prototype[prop];
    });
}

Test.prototype = {

    onAuthenticate: function (data, conn, callback) {
        if (data.status != 'success') {
            return conn.onError(data, conn);
        }
        log.debug('%s auth complete', conn.name);

        if (callback) {
            callback(data, conn);
        }
    },

    getDeviceGuid: function (index) {
        index = index % this.devicesCount;
        if (Array.isArray(this.deviceGuids)) {
            return this.deviceGuids[index];
        }

        var formattedNumber = ("00000000" + index).slice(-8);
        return this.deviceGuids.replace('{#}', formattedNumber);
    },

    getDeviceGuids: function (client) {
        var index = client.id % this.clientsCount;
        if (this.devicesCount === this.clientsCount) {

            return [this.getDeviceGuid(index)];

        }
        if (this.devicesCount < this.clientsCount) {

            return [this.getDeviceGuid(index)];

        } else if (this.devicesCount > this.clientsCount) {

            var deviceGuids = [];
            var devicesPerClient = Math.ceil(this.devicesCount / this.clientsCount);
            var startIndex = index * devicesPerClient;
            var endIndex = Math.ceil(index * devicesPerClient + devicesPerClient);
            for (var i = startIndex; i < endIndex; i++) {
                deviceGuids.push(this.getDeviceGuid(i));
            }
            return deviceGuids;

        }
    },

    sendMessages: function (conn, callback) {
        var self = this;
        conn.intervalId = setInterval(function () {
            if (self.index++ >= self.total) {
                clearInterval(conn.intervalId);
                conn.intervalId = null;
                return;
            }

            callback.call(self, conn);
        }, this.intervalMillis);
    },

    doneAllSent: function () {
        if (++this.sent < this.total) {
            return;
        }

        var received = this.received;
        var result = this.getResult();
        var self = this;

        var doneIfMsgsWontCome = function () {

            if (self.received !== received) {
                received = self.received;
                result = self.getResult();
                setTimeout(doneIfMsgsWontCome, self.waitDelay);
                return;
            }

            self.complete(null, result);
        };
        setTimeout(doneIfMsgsWontCome, this.waitDelay);

        log.info('-- All messages sent. %s sec wait for incoming messages...',
            Math.floor(this.waitDelay / 1000));
    },

    complete: function (err, result) {
        if (this.oncomplete) {
            this.oncomplete(err, result)
            this.oncomplete = null;
        }
    },

    doComplete: function (err, result) {
        var self = this;
        log.info('-- Completed \'%s\'. Closing connnections...', this.name);
        this.closeConnections(function () {
            if (self.ondone) {
                self.ondone(err, result);
                self.ondone = null;
            }
        });
    },

    closeConnections: function (callback) {

        this.closeConnectionsImpl(this.clients);
        this.closeConnectionsImpl(this.devices);
        this.closeConnectionsImpl(this.connections);

        if (callback) {
            callback();
        }
    },

    closeConnectionsImpl: function (connections) {

        if (!connections) {
            return;
        }

        connections.forEach(function (connection) {
            connection.socket.close();
            if (connection.intervalId) {
                clearInterval(connection.intervalId);
            }
        });
    },

    onError: function (err, conn) {
        this.statistics.errors = true;
        this.statistics.errorsCount++;
        log.error('-- Error: ' + JSON.stringify(err));
        conn.socket.close();
        if (conn.intervalId) {
            clearInterval(conn.intervalId);
        }

        //this.complete({
        //    message: 'Error in ' + conn.name,
        //    error: err
        //}, this.getResult());
    }
}

module.exports = Test;