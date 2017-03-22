import { assign, forIn, keys } from "lodash";
import Promise from "bluebird";
import Loki from "lokijs";
import LokiIndexedAdapter from "lokijs/src/loki-indexed-adapter";

if (!("indexedDB" in window)) {
    throw "Cannot find indexedDB";
}

const DEFINITIONS = {

    analyses: {
        unique: ["_id"],
        indices: ["sample_id", "username"],
        retain: true
    },

    files: {
        unique: ["_id"],
        indices: ["name", "ready"],
        retain: true
    },

    groups: {
        unique: ["_id"]
    },

    history: {
        unique: ["_id"],
        indices: ["operation", "timestamp", "entry_id", "entry_version", "username", "index", "index_version"],
        retain: true
    },

    hmm: {
        unique: ["_id", "cluster"],
        indices: ["label"],
        retain: true
    },

    hosts: {
        unique: ["_id", "file", "job"],
        indices: ["added"],
        retain: true
    },

    indexes: {
        unique: ["_id", "index_version"],
        indices: ["timestamp", "virus_count", "ready", "has_files"],
        retain: true
    },

    jobs: {
        unique: ["_id"],
        indices: ["username"],
        retain: true
    },

    samples: {
        unique: ["_id", "name"],
        indices: ["added", "username", "imported", "archived", "analyzed"],
        retain: true
    },

    status: {
        unique: ["_id"],
        retain: true
    },

    viruses: {
        unique: ["_id", "name"],
        indices: ["modified", "abbreviation", "last_indexed_version"],
        retain: true
    },

    updates: {
        unique: ["_id"],
        retain: true
    },

    users: {
        unique: ["_id"]
    }

};

export default class Database {

    constructor () {
        this.collectionNames = keys(DEFINITIONS);
    }

    open () {
        return new Promise ((resolve, reject) => {

            this.lokiAdapter = new LokiIndexedAdapter(`virtool-${dispatcher.settings.get("server_id")}`);

            window.lokiAdapter = this.lokiAdapter;

            this.loki = new Loki(null, {
                env: "BROWSER",
                autosave: true,
                adapter: this.lokiAdapter
            });

            this.loki.loadDatabase({}, (err) => {
                if (err) {
                    reject();
                } else {
                    forIn(DEFINITIONS, (definition, collectionName) => {
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
                    });

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
    }
}
