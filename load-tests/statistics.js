function Statistics() {
    this.min = Number.MAX_VALUE;
    this.max = Number.MIN_VALUE;
    this.sum = 0;
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
    getAvg: function () {
        return this.sum / this.count;
    }
}

module.exports = Statistics;