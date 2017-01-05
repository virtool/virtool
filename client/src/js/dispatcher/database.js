import { assign, forIn } from "lodash-es";
import Promise from "bluebird";
import Loki from "lokijs";
import LokiIndexedAdapter from "lokijs/src/loki-indexed-adapter";

if (!("indexedDB" in window)) {
    throw "Cannot find indexedDB";
}

function Database (definitions, dispatcher) {

    this.collectionNames = [];

    this.open = () => {
        return new Promise((resolve, reject) => {

            this.lokiAdapter = new LokiIndexedAdapter(`virtool-${dispatcher.settings.get("server_id")}`);

            window.lokiAdapter = this.lokiAdapter;

            this.loki = new Loki(null, {
                env: "BROWSER",
                autosave: true,
                adapter: this.lokiAdapter
            });

            this.loki.loadDatabase({}, function (err) {
                if (err) {
                    reject();
                } else {
                    forIn(definitions, function (definition, collectionName) {
                        let collection = this.loki.getCollection(collectionName);

                        if (!collection) {
                            collection = this.loki.addCollection(collectionName, {
                                unique: definition.unique,
                                indices: definition.indices
                            });
                        }

                        collection.request = (method, data) => {
                            return dispatcher.send({
                                interface: collectionName,
                                method: method,
                                data: data
                            });
                        };

                        collection.events["change"] = [];

                        assign(collection, {
                            off: collection.removeListener,
                            retain: definition.retain,
                            observedSyncCount: 0,
                            expectedSyncCount: 0,
                            synced: false
                        });

                        this[collectionName] = collection;

                        this.collectionNames.push(collectionName);

                    }.bind(this));

                    window.onbeforeunload = () => {
                        dispatcher.db.collectionNames.forEach((collectionName) => {
                            const collection = dispatcher.db[collectionName];

                            if (!collection.retain) {
                                collection.clear();
                            }
                        });
                    };

                    resolve();
                }
            });
        });
    };
}

export default Database;
