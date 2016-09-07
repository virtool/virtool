var _ = require('lodash');
var Loki = require('lokijs');
var LokiIndexedAdapter = require('lokijs/src/loki-indexed-adapter');

if (!'indexedDB' in window) throw 'Cannot find indexedDB';

function Database(definitions, dispatcher) {

    this.definitions = definitions;

    this.collectionNames = [];

    this.open = function () {
        return new Promise(function (resolve, reject) {

            this.lokiAdapter = new LokiIndexedAdapter("virtool-" + dispatcher.settings.get("server_id"));

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
                    _.forIn(definitions, function (definition, collectionName) {
                        var collection = this.loki.getCollection(collectionName);

                        if (!collection) {
                            collection = this.loki.addCollection(collectionName, {
                                unique: definition.unique,
                                indices: definition.indices
                            });
                        }

                        collection.off = collection.removeListener;

                        collection.request = function (operation, data) {
                            return dispatcher.send({
                                methodName: operation,
                                collectionName: collectionName,
                                data: data
                            });
                        };

                        collection.events["change"] = [];

                        this[collectionName] = collection;

                        this.collectionNames.push(collectionName);

                    }.bind(this));

                    resolve();
                }
            }.bind(this));

        }.bind(this));
    };

    this.update = function (collectionName, documents, callback, context) {
        if (!document.hasOwnProperty('_id')) throw 'Attempted to update a document without an _id field.';

        this.dexie[collectionName].bulkPut(documents).then(function () {
            callback.bind(context)();
        });
    };

    this.remove = function (collectionName, documentId, callback, context) {
        this.dexie[collectionName].delete(documentId).then(function () {
            callback.bind(context)();
        });
    };
};

module.exports = Database;