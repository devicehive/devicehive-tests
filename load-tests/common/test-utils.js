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

    getDeviceGuid: function (context, index) {
        index = index % context.devicesCount;
        if (Array.isArray(context.deviceGuids)) {
            return context.deviceGuids[index];
        }

        var formattedNumber = ("00000000" + index).slice(-8);
        return context.deviceGuids.replace('{#}', formattedNumber);
    }
}