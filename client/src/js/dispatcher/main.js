var _ = require('lodash');
var Bowser = require('bowser');

var Events = require("./Events.js");
var User = require("./user.js");
var Settings = require('./Settings.js');
var Database = require('./Database.js');
var Router = require("./Router.js");
var Transactions = require("./transactions.js");

var collectionOperations = ['add', 'update', 'remove'];

function Dispatcher(onReady) {

    this.events = new Events(['syncing', 'synced', 'ping', 'authenticated', 'closed'], this);

    this.browser = _.pick(Bowser, ['name', 'version']);

    this.runningOperationCount = 0;

    this.user = new User();
    this.router = new Router();
    this.settings = new Settings();
    this.transactions = new Transactions();
    
    this.db = new Database({

        "jobs": {
            unique: ["_id"],
            indices: ["username", "archived"],
            retain: true
        },
        "samples": {
            unique: ["_id", "name"],
            schema: ["added", "username", "imported", "archived", "analyzed"],
            retain: true
        },
        "viruses": {
            unique: ["_id", "name"],
            schema: ["modified", "abbreviation", "last_indexed_version"],
            retain: true
        },
        "history": {
            unique: ["_id"],
            schema: ["operation", "timestamp", "entry_id", "entry_version", "username", "index", "index_version"],
            retain: true
        },
        "indexes": {
            unique: ["_id", "index_version"],
            schema: ["timestamp", "virus_count", "ready", "has_files"],
            retain: true
        },
        "hosts": {
            unique: ["_id", "file", "job"],
            schema: ["added"],
            retain: true
        },
        "users": {
            unique: ["_id"]
        },
        "groups": {
            unique: ["_id"]
        },
        "reads": {
            unique: ["_id"]
        },
        "files": {
            unique: ["_id"]
        }

    }, this);

    /**
     * Takes a message object, stringifies it, and sends it to the server via web socket. Binds a transaction ID to the
     * message. When the transaction succeeds or fails, the corresponding callback functions will be called.
     *
     * @param message {object} - the message to send to the server.
     * @param success {func} - the function to call if the transaction succeeds.
     * @param failure {func} - the function to call if the transaction fails.
     * @func
     */
    this.send = function (message, success, failure) {
        message.tid = this.transactions.register(success, failure);
        this.connection.send(JSON.stringify(message));
    };

    this.sync = function () {

        var dispatcher = this;

        this.send({
            collectionName: 'settings',
            methodName: 'download',
            data: null
        }, function (data) {

            this.settings.update(data);

            this.db.open().then(function () {

                var manifests = {};

                this.db.collectionNames.forEach(function (collectionName) {
                    manifests[collectionName] = {};

                    this.db[collectionName].find().forEach(function (document) {
                        manifests[collectionName][document._id] = document._version;
                    });

                }, this);

                return manifests;

            }.bind(this)).then(function (manifests) {

                console.log(manifests);

                dispatcher.send({
                    collectionName: 'dispatcher',
                    methodName: 'sync',
                    data: {manifests: manifests}
                }, dispatcher.onSync);

            });

        }.bind(this));
    };

    this.onSync = function (data) {
        this.syncOperationCount = data;
        this.checkSynced();
    }.bind(this);

    this.checkSynced = function () {

        var progress = this.runningOperationCount / this.syncOperationCount;

        if (progress < 1) {
            this.emit('syncing', progress);
            setTimeout(this.checkSynced, 50);
        } else {
            this.emit('synced');
        }
    }.bind(this);

    this.listen = function (name) {
        dispatcher.send({
            collectionName: 'dispatcher',
            methodName: 'listen',
            data: {'name': name}
        });
    };

    this.unlisten = function (name) {
        dispatcher.send({
            collectionName: 'dispatcher',
            methodName: 'unlisten',
            data: {'name': name}
        });
    };

    // When a websocket message is received, this method is called with the message as the sole argument. Every message
    // has a property 'operation' that tells the dispatcher what to do. Illegal operation names will throw an error.
    this.handle = function (message) {

        var operation = message.operation;

        var messageDescriptor = message.collection_name + "." + message.operation;

        console.log(message.collection_name + '.' + message.operation);

        if (_.includes(collectionOperations, operation)) {
            if (message.sync) this.runningOperationCount += message.data.length;

            if (operation === "update") {
                try {
                    this.db[message.collection_name].update(message.data);
                } catch (err) {
                    this.db[message.collection_name].insert(message.data);
                }
            } else {
                this.db[message.collection_name].remove(message.data);
            }
        }

        else {

            switch (operation) {

                case 'transaction':
                    this.transactions.trigger(message.data.tid, message.data.success, message.data.data);
                    break;

                case 'ping':
                    this.events.emit('ping');
                    break;

                case 'set':
                    this.settings.update(message.data);
                    break;
                
                case 'amend':
                    this.user.load(message.data);
                    break;

                case 'deauthorize':
                    this.user.deauthorize(message.data);
                    break;

                default:
                    console.warn('Received unknown web socket operation in message: ' + messageDescriptor);
            }
        }
    };

    this.establishConnection = function (callback) {

        var dispatcher = this;

        // Setup the Websocket connection.
        var protocol = location.protocol === 'https:' ? 'wss': 'ws';

        dispatcher.connection = new WebSocket(protocol + '://' + location.host + '/ws');

        dispatcher.connection.onopen = function () {
            console.log('Established WebSocket connection.');
            callback();
        };

        dispatcher.connection.onmessage = function (event) {
            dispatcher.handle(JSON.parse(event.data));
        };

        dispatcher.connection.onclose = function () {
            dispatcher.emit('closed');
        };
    };

    this.establishConnection(onReady);
}

module.exports = Dispatcher;