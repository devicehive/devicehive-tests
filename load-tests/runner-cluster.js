var cluster = require('cluster');
var numCPUs = require('os').cpus().length;
var app = require('./common/app');

if (cluster.isMaster) {
    // Fork workers.
    for (var i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', function (worker) {
        console.log('worker ' + worker.process.pid + ' exit');
    });

} else {
    app.start();
}