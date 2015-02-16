var log = require('../../common/log.js');

module.exports = {

    substitute: function (obj, field, valueCb) {

        if (obj == null || typeof (obj) != 'object') {
            return;
        }

        var self = this;

        var keys = Object.keys(obj);
        //var pattern = null;
        keys.forEach(function (key) {

            //pattern = obj[key];
            //if (pattern != null && typeof (pattern) === 'string' && (pattern.indexOf(field) >= 0)) {
            //    obj[key] = valueCb(pattern, field);
            //    return;
            //}

            if (obj[key] === field) {
                obj[key] = valueCb();
                return;
            }

            self.substitute(obj[key], field, valueCb);
        });
    },

    onWsAuthenticate: function (data, sender, callback) {
        if (data.status != 'success') {
            return sender.onWsError(data, sender);
        }
        log.debug('%s auth complete', sender.name);

        if (callback) {
            callback(data, sender);
        }
    },

    getDeviceGuid: function (context, index) {
        index = index % context.devicesCount;
        if (Array.isArray(context.deviceGuids)) {
            return context.deviceGuids[index];
        }

        var formattedNumber = ("00000000" + index).slice(-8);
        return context.deviceGuids.replace('{#}', formattedNumber);
    },

    getDeviceGuids: function (context, id) {
        var index = id % context.clientsCount;
        if (context.devicesCount === context.clientsCount) {

            return [this.getDeviceGuid(context, index)];

        }
        if (context.devicesCount < context.clientsCount) {

            return [this.getDeviceGuid(context, index)];

        } else if (context.devicesCount > context.clientsCount) {

            var deviceGuids = [];
            var devicesPerClient = Math.ceil(context.devicesCount / context.clientsCount);
            var startIndex = index * devicesPerClient;
            var endIndex = Math.ceil(index * devicesPerClient + devicesPerClient);
            for (var i = startIndex; i < endIndex; i++) {
                deviceGuids.push(this.getDeviceGuid(context, i));
            }
            return deviceGuids;

        }
    },

    sendMessages: function (context, sender, callback) {
        sender.intervalId = setInterval(function () {
            if (context.index++ >= context.total) {
                clearInterval(sender.intervalId);
                sender.intervalId = null;
                return;
            }

            callback.call(context, sender);
        }, context.intervalMillis);
    },

    doneAllSent: function (context) {
        if (++context.sent < context.total) {
            return;
        }

        var received = context.received;
        var result = context.getResult();
        var self = this;

        var doneIfMsgsWontCome = function () {

            if (context.received !== received) {
                received = context.received;
                result = context.getResult();
                setTimeout(doneIfMsgsWontCome, context.waitDelay);
                return;
            }

            self.complete(context, null, result);
        };
        setTimeout(doneIfMsgsWontCome, context.waitDelay);

        log.info('-- All messages sent. %s sec wait for incoming messages...',
            Math.floor(context.waitDelay / 1000));
    },

    complete: function (context, err, result) {
        if (context.oncomplete) {
            context.oncomplete(context, err, result);
            context.oncomplete = null;
        }
    },

    doRestComplete: function (context, err, result) {

        context.senders.forEach(function (sender) {
            if (sender.intervalId) {
                clearInterval(sender.intervalId);
            }
        });

        log.info('-- Completed \'%s\'.', context.name);

        if (context.ondone) {
            context.ondone(err, result);
            context.ondone = null;
        }
    },

    doWsComplete: function (context, err, result) {
        log.info('-- Completed \'%s\'. Closing connnections...', context.name);
        this.closeConnections(context);

        if (context.ondone) {
            context.ondone(err, result);
            context.ondone = null;
        }
    },

    closeConnections: function (context) {
        this.closeConnectionsImpl(context.clients);
        this.closeConnectionsImpl(context.devices);
        this.closeConnectionsImpl(context.connections);
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

    onWsError: function (context, err, sender) {
        context.statistics.errors = true;
        context.statistics.errorsCount++;
        log.error('-- Error: ' + JSON.stringify(err));
        sender.socket.close();
        if (sender.intervalId) {
            clearInterval(sender.intervalId);
        }

        //context.complete({
        //    context,
        //    message: 'Error in ' + sender.name,
        //    error: err
        //}, context.getResult());
    }
}