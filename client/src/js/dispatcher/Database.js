var _ = require('lodash');
var Loki = require('lokijs');

var Collection = require("./Collection.js");

if (!'indexedDB' in window) throw 'Cannot find indexedDB';

function Database(definitions, dispatcher) {

    this.definitions = definitions;

    this.collectionNames = [];

    this.open = function () {
        return new Promise(function (resolve, reject) {

            this.loki = new Loki(null, {
                env: "BROWSER",
                autosave: true
            });

            _.forIn(definitions, function (definition, collectionName) {
                var collection = this.loki.addCollection(definition.name, {
                    unique: definition.unique,
                    indices: definition.indices
                });

                collection.off = collection.removeListener;

                collection.request = function (operation, data, success, failure) {
                    dispatcher.send({
                        methodName: operation,
                        collectionName: collectionName,
                        data: data
                    }, success, failure);
                };

                this[collectionName] = collection;
                this.collectionNames.push(collectionName);

            }.bind(this));

            this.loki.loadDatabase({}, function (err, data) {
                if (err) {
                    reject();
                } else {
                    resolve(data);
                }
            });

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