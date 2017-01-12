import { pick, transform, includes, assign, every } from "lodash";
import Bowser from "bowser";

import User from "./user";
import Events from "./events";
import Router from "./router";
import Settings from "./settings";
import Database from "./database";
import Transactions from "./transactions";

function Dispatcher (onReady) {

    this.events = new Events(["syncing", "synced", "ping", "authenticated", "closed"], this);

    this.browser = pick(Bowser, ["name", "version"]);

    this.user = new User();
    this.router = new Router();
    this.settings = new Settings();
    this.transactions = new Transactions();

    this.syncProgress = 0;
    this.syncProgressStep = 0;

    this.db = new Database();

    /**
     * Takes a message object, stringifies it, and sends it to the server via web socket. Binds a transaction ID to the
     * message. When the transaction succeeds or fails, the corresponding callback functions will be called.
     *
     * @param message {object} - the message to send to the server.
     * @func
     */
    this.send = (message) => {
        var transaction = this.transactions.register();
        message.tid = transaction.tid;
        this.connection.send(JSON.stringify(message));

        return transaction;
    };

    this.sync = () => {
        this.send({interface: "settings", method: "download", data: null})
            .success((data) => {
                this.settings.update(data);

                this.db.open()
                    .then(() => {
                        const collectionCount = this.db.collectionNames.length

                        this.syncProgressStep = 1 / (collectionCount + 1);

                        this.db.collectionNames.forEach((collectionName) => {

                            const collection = this.db[collectionName];

                            const manifest = collection.mapReduce(
                                (document) => ({_id: document._id, _version: document._version}),
                                (documents) => (
                                    transform(
                                        documents,
                                        (result, document) => result[document._id] = document._version,
                                        {}
                                    )
                                )
                            );

                            collection.request("sync", manifest)
                                .update((update) => {
                                    collection.expectedSyncCount = update;

                                    if (collection.expectedSyncCount === 0) {
                                        this.syncProgress += this.syncProgressStep;
                                        this.emit("syncing", this.syncProgress);

                                        collection.synced = true;
                                        this.checkSynced();
                                    }
                                });

                            this.syncProgress += this.syncProgressStep * (1 / collectionCount);

                            this.emit("syncing", this.syncProgress);
                        });
                    });
            });
    };

    this.checkSynced = () => {
        if (every(this.db.collectionNames, collectionName => this.db[collectionName].synced)) {
            this.emit("synced");
        }
    };

    // When a websocket message is received, this method is called with the message as the sole argument. Every message
    // has a property "operation" that tells the dispatcher what to do. Illegal operation names will throw an error.
    this.handle = (message) => {

        var iface = message.interface;
        var operation = message.operation;

        console.log(`${iface}.${operation}`); // eslint-disable-line

        if (iface === "transaction") {
            switch (operation) {
                case "fulfill":
                    this.transactions.fulfill(message.data.tid, message.data.success, message.data.data);
                    break;

                case "update":
                    this.transactions.update(message.data.tid, message.data.data);
                    break;

                default:
                    throw(`Illegal transaction operation: ${operation}`);

            }
        }

        else if (operation === "amend") {
            this.user.load(message.data);
        }

        else if (includes(this.db.collectionNames, iface)) {

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

                updates.forEach((update) => {
                    var existingDocument = collection.findOne({_id: update._id});

                    if (existingDocument) {
                        var amended = assign(pick(existingDocument, ["$loki", "meta"]), update);
                        collection.update(amended);
                    } else {
                        collection.insert(message.data);
                    }
                });

                collection.emit("change");
            }

            if (operation === "remove") {
                this.db[message.interface].removeWhere({"_id": {"$in": message.data}});
                this.db[message.interface].emit("change");
            }

        }

        else {

            switch (operation) {

                case "ping":
                    this.events.emit("ping");
                    break;

                case "set":
                    this.settings.update(message.data);
                    break;

                case "deauthorize":
                    this.user.deauthorize(message.data);
                    break;

                default:
                    throw(`Received unknown web socket operation in message ${message.interface}.${message.operation}`);
            }
        }
    };

    this.establishConnection = (callback) => {

        var dispatcher = this;

        var protocol = window.location.protocol === "https:" ? "wss" : "ws";

        dispatcher.connection = new window.WebSocket(`${protocol}://${window.location.host}/ws`);

        dispatcher.connection.onopen = () => {
            callback();
        };

        dispatcher.connection.onmessage = (event) => {
            dispatcher.handle(JSON.parse(event.data));
        };

        dispatcher.connection.onclose = () => {
            dispatcher.emit("closed");
        };
    };

    this.establishConnection(onReady);
}

export default Dispatcher;
