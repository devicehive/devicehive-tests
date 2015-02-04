function Statistics() {
    this.start = new Date();

    this.min = Number.MAX_VALUE;
    this.max = Number.MIN_VALUE;
    this.sum = 0;
    this.count = 0;
    this.subscribedExpected = {};
    this.errors = false;
    this.serverErrorsCount = 0;
    this.errorsCount = 0;
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

    getStart: function() {
        return this.start.toLocaleDateString() + ' ' + this.start.toLocaleTimeString();
    },

    getEnd: function() {
        var end = new Date();
        return end.toLocaleDateString() + ' ' + end.toLocaleTimeString();
    },

    getMin: function () {
        return this.min === Number.MAX_VALUE ? 0 : this.min;
    },

    getMax: function () {
        return this.max === Number.MIN_VALUE ? 0 : this.max;
    },

    getAvg: function () {
        return this.sum / this.count;
    }
}

module.exports = Statistics;