function Statistics() {
    this.min = Number.MAX_VALUE;
    this.max = Number.MIN_VALUE;
    this.sum = 0;
    this.errors = false;
    this.count = 0;
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