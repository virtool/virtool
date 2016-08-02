var _ = require('lodash');
var Bowser = require('bowser');

var Events = require("./Events.js");
var User = require("./user.js");
var Settings = require('./Settings.js');
var Database = require('./Database.js');
var Router = require("./Router.js");
var Transactions = require("./transactions.js");

function Dispatcher(onReady) {

    this.events = new Events(['syncing', 'synced', 'ping', 'authenticated', 'closed'], this);

    this.browser = _.pick(Bowser, ['name', 'version']);

    this.runningOperationCount = 0;
    this.syncOperationCount = 0;

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
            indices: ["added", "username", "imported", "archived", "analyzed"],
            retain: true
        },
        "viruses": {
            unique: ["_id", "name"],
            indices: ["modified", "abbreviation", "last_indexed_version"],
            retain: true
        },
        "hmm": {
            unique: ["_id", "cluster"],
            indices: ["label"],
            retain: true
        },
        "history": {
            unique: ["_id"],
            indices: ["operation", "timestamp", "entry_id", "entry_version", "username", "index", "index_version"],
            retain: true
        },
        "indexes": {
            unique: ["_id", "index_version"],
            indices: ["timestamp", "virus_count", "ready", "has_files"],
            retain: true
        },
        "hosts": {
            unique: ["_id", "file", "job"],
            indices: ["added"],
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
     * @func
     */
    this.send = function (message) {
        var transaction = this.transactions.new();
        message.tid = transaction.tid;
        this.connection.send(JSON.stringify(message));

        return transaction;
    };

    this.sync = function () {

        var dispatcher = this;

        this.send({
            collectionName: 'settings',
            methodName: 'download',
            data: null
        }).success(function (data) {

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

                dispatcher.send({collectionName: 'dispatcher', methodName: 'sync', data: {manifests: manifests}})
                    .update(function (update) {
                        dispatcher.syncOperationCount = update;
                    });
            });

        }, this);
    };

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

        var collectionName = message.collection_name;
        var operation = message.operation;

        var messageDescriptor = message.collection_name + "." + message.operation;

        console.log(message.collection_name + '.' + message.operation);

        if (collectionName === 'transaction') {
            switch (operation) {
                case "fulfill":
                    this.transactions.fulfill(message.data.tid, message.data.success, message.data.data);
                    break;

                case "update":
                    this.transactions.update(message.data.tid, message.data.data);
                    break;

                default:
                    console.throw("Illegal transaction operation: " + operation);

            }
        }

        else if (_.includes(this.db.collectionNames, collectionName)) {
            if (message.sync && this.syncOperationCount > 0) {
                this.runningOperationCount += message.data.length || 1;
                var progress = this.runningOperationCount / this.syncOperationCount;
                progress < 1 ? this.emit('syncing', progress): this.emit('synced');
            }

            if (operation === "update") {
                var collection = this.db[message.collection_name];

                var updates = message.data.constructor === Array ? message.data: [message.data];

                updates.forEach(function (update) {

                    var existingDocument = collection.findOne({_id: update._id});

                    if (existingDocument) {
                        var amended = _.assign(_.pick(existingDocument, ["$loki", "meta"]), update);
                        collection.update(amended);
                    } else {
                        collection.insert(message.data);
                    }
                });

            }

            if (operation === "remove") {
                this.db[message.collection_name].removeWhere({"_id": {"$in": message.data}});
            }

        }

        else {

            switch (operation) {

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