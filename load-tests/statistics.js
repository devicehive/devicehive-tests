function Statistics() {
    this.min = Number.MAX_VALUE;
    this.max = Number.MIN_VALUE;
    this.sum = 0;
    this.errors = false;
    this.count = 0;
    this.subscribedExpected = {};
}

Statistics.prototype = {

    add: function (value) {
        this.count++;
        
        if (value < this.min) {
            this.min = value;
        }
        
        if (value > this.max) {
            this.max = value;
        }
        
        this.sum += value;
    },

    addSubscribed: function (name, guids) {

        var self = this;
        guids || ((guids = ['all']) && (this.all = true));

        guids.forEach(function (guid) {
            var key = [name, '-', guid].join('');
            var subscribedExpected = self.subscribedExpected[key];
            if (!subscribedExpected) {
                subscribedExpected = self.subscribedExpected[key] = {
                    subscribed: 0,
                    expected: 0
                };
            }

            subscribedExpected.subscribed++;
        });
    },

    addExpected: function (name, guid) {
        guid = this.all ? 'all' : guid;
        name = [name, '-', guid].join('');
        var subscribedExpected = this.subscribedExpected[name];

        if (!subscribedExpected) {
            return;
        }

        subscribedExpected.expected += subscribedExpected.subscribed;
    },

    getExpected: function() {
        var self = this;
        var expected = 0;
        var keys = Object.keys(this.subscribedExpected);
        keys.forEach(function (key) {
            expected += self.subscribedExpected[key].expected;
        });
        return expected;
    },

    getMin: function () {
        return this.count > 0 ? this.min : 0;
    },

    getMax: function () {
        return this.count > 0 ? this.max : 0;
    },

    getAvg: function () {
        return this.sum / this.count;
    }
}

module.exports = Statistics;