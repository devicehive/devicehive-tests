const WebSocket = require('ws');
const utils = require('./utils');
class WSConnection {

    constructor(url) {
        this.socket = new WebSocket(url);
        this.dateOpened = null;
    }

    connect(callback) {
        this.socket.onopen = () => {
            this.dateOpened = new Date().toISOString();
            console.log(`Connection opened at ${this.dateOpened}`);
            return callback();
        };

        this.socket.onerror = err => {
            console.log(JSON.stringify(err));
        };

        this.socket.onclose = () => {
            console.log(`Connection, which was opened at ${this.dateOpened}, closed`);
        };
    }

    send(obj) {
        const msg = JSON.stringify(obj);
        console.log('-> %s', msg);
        this.socket.send(msg);
    }

    on(obj = {}, callback = utils.emptyCb) {
        let received = false;
        let timeoutHandler = null;

        const listener = event => {
            console.log(`<- ${event.data}`);
            const data = JSON.parse(event.data);

            if (utils.matchesFields(data, obj)) {
                this.socket.removeEventListener('message', listener);
                clearTimeout(timeoutHandler);
                received = true;
                callback(null, data);
            }
        };

        this.socket.addEventListener('message', listener);

        const timeout = utils.WEBSOCKET_TIMEOUT;

        timeoutHandler = setTimeout(() => {
            if (!received) {
                this.socket.removeEventListener('message', listener);
                callback(new Error('waitFor() timeout: hasn\'t got message, for ' + timeout + 'ms'));
            }
        }, timeout);
    }

    close() {
        this.socket.close();
    }

    getReadyState() {
        return this.socket.readyState;
    }
}

module.exports = WSConnection;