var _ = require('lodash');
var Loki = require('lokijs');
var LokiIndexedAdapter = require('lokijs/src/loki-indexed-adapter');

var Collection = require("./Collection.js");

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

                        collection.request = function (operation, data, success, failure) {
                            dispatcher.send({
                                methodName: operation,
                                collectionName: collectionName,
                                data: data
                            }, success, failure);
                        };

                        var emitChange = function (data) {
                            collection.emit("change", data);
                        };

                        collection.events["change"] = [];

                        collection.on("insert", emitChange);
                        collection.on("update", emitChange);
                        collection.on("delete", emitChange);

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