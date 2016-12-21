var _ = require('lodash');
var Bowser = require('bowser');

import Events from './Events.js';
import User from './user.js';

var Settings = require('./Settings.js');
var Database = require('./Database.js');
var Router = require("./Router.js");
var Transactions = require("./transactions.js");

function Dispatcher(onReady) {

    this.events = new Events(['syncing', 'synced', 'ping', 'authenticated', 'closed'], this);

    this.browser = _.pick(Bowser, ['name', 'version']);

    this.user = new User();
    this.router = new Router();
    this.settings = new Settings();
    this.transactions = new Transactions();

    this.syncProgress = 0;
    this.syncProgressStep = 0;

    this.db = new Database({

        "jobs": {
            unique: ["_id"],
            indices: ["username"],
            retain: true
        },

        "files": {
            unique: ["_id"],
            indices: ["name", "ready"],
            retain: true
        },

        "samples": {
            unique: ["_id", "name"],
            indices: ["added", "username", "imported", "archived", "analyzed"],
            retain: true
        },

        "analyses": {
            unique: ["_id"],
            indices: ["sample_id", "username"],
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
            interface: 'settings',
            method: 'download',
            data: null
        }).success(function (data) {

            dispatcher.settings.update(data);

            dispatcher.db.open()
                .then(function () {

                    var collectionCount = dispatcher.db.collectionNames.length

                    dispatcher.syncProgressStep = 1 / (collectionCount + 1);

                    dispatcher.db.collectionNames.forEach(function (collectionName) {

                        var collection = dispatcher.db[collectionName];

                        var manifest = collection.mapReduce(
                            function (document) {
                                return {_id: document._id, _version: document._version};
                            },

                            function (documents) {
                                return _.transform(documents, function (result, document) {
                                    result[document._id] = document._version;
                                }, {});
                            }
                        );

                        collection.request("sync", manifest)
                            .update(function (update) {
                                collection.expectedSyncCount = update;

                                if (collection.expectedSyncCount === 0) {
                                    dispatcher.syncProgress += dispatcher.syncProgressStep;
                                    dispatcher.emit("syncing", dispatcher.syncProgress);

                                    collection.synced = true;
                                    dispatcher.checkSynced();
                                }
                            });

                        dispatcher.syncProgress += dispatcher.syncProgressStep * (1 / collectionCount);

                        dispatcher.emit("syncing", dispatcher.syncProgress);

                    });

                });

        });
    };

    this.checkSynced = function () {
        var collectionNames = _.without(dispatcher.db.collectionNames, "reads", "files");

        var allSynced = _.every(collectionNames, function (collectionName) {
            return dispatcher.db[collectionName].synced;
        });

        if (allSynced) {
            this.emit("synced");
        }
    };

    // When a websocket message is received, this method is called with the message as the sole argument. Every message
    // has a property 'operation' that tells the dispatcher what to do. Illegal operation names will throw an error.
    this.handle = function (message) {

        var iface = message.interface;
        var operation = message.operation;

        console.log(iface + "." + message.operation);

        if (iface === 'transaction') {
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

        else if (operation === "amend") {
            this.user.load(message.data);
        }

        else if (_.includes(this.db.collectionNames, iface)) {

            var collection = this.db[message.interface];

            if (message.sync) {
                var count = message.data.length || 1;

                collection.observedSyncCount += count;

                this.syncProgress += this.syncProgressStep * count / collection.expectedSyncCount;

                this.emit("syncing", this.syncProgress);

                if (collection.observedSyncCount === collection.expectedSyncCount) {
                    collection.synced = true;
                    this.checkSynced();
                }
            }

            if (operation === "update") {


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

                collection.emit('change');
            }

            if (operation === "remove") {
                this.db[message.interface].removeWhere({"_id": {"$in": message.data}});
                this.db[message.interface].emit('change');
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

                case 'deauthorize':
                    this.user.deauthorize(message.data);
                    break;

                default:
                    console.warn(
                        'Received unknown web socket operation in message: ' +
                        (message.interface + "." + message.operation)
                    );
            }
        }
    };

    this.establishConnection = function (callback) {

        var dispatcher = this;

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