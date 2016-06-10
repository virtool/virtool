var _ = require('lodash');

function PersistentStorage(onReady, context) {
    
    this.database = null;

    this.databaseId = 'virtool-' + dispatcher.settings.get('server_id');

    if (!'indexedDB' in window) throw 'Cannot find indexedDB';

    var openRequest = indexedDB.open(this.databaseId);

    openRequest.onupgradeneeded = function (event) {
        var database = event.target.result;

        _.forEach(dispatcher.collections, function (collection) {
            if (collection.useLocalStorage) database.createObjectStore(collection.name, {keyPath: '_id'});
        });

    }.bind(this);

    openRequest.onsuccess = function(event) {
        this.database = event.target.result;
        this.restoreCollections(onReady, context);
    }.bind(this);

    openRequest.onerror = function() {
        throw "Error opening connection to database";
    };

    this.deleteDatabase = function (onSuccess) {
        this.database.close();
        var request = indexedDB.deleteDatabase(this.databaseId);

        request.onsuccess = function () {
            console.log('Deleted database successfully');
            if (onSuccess) onSuccess();
        }
    };

    this.getStore = function (collectionName, type) {
        var transaction = this.database.transaction([collectionName], type);
        return transaction.objectStore(collectionName);
    };

    this.restoreCollections = function (callback, context) {
        var complete = {};

        _.forEach(dispatcher.collections, function (collection) {
            if (collection.useLocalStorage) complete[collection.name] = false;
        });

        var collectionCount = _.values(complete).length;

        _.forIn(dispatcher.collections, function (collection) {
            if (collection.useLocalStorage) {
                var store = this.getStore(collection.name, 'readonly');
                var cursor = store.openCursor();

                cursor.onsuccess = function (event) {
                    var result = event.target.result;

                    if (result) {
                        collection.documents.push(result.value);
                        result.continue();
                    } else {
                        complete[collection.name] = true;
                        var numberComplete = _.without(_.values(complete), false).length;

                        if (numberComplete === collectionCount) {
                            callback.bind(context)();
                        }
                    }
                };

                cursor.onerror = function () {
                    throw 'Could not generate manifest for collection ' + collection.name;
                };
            }
        }.bind(this));
    };

    this.add = function (collectionName, document, callback, context) {
        if (!document.hasOwnProperty('_id')) throw 'Attempted to add a document without an _id to storage.';

        var store = this.getStore(collectionName, 'readwrite');
        var request = store.put(document);

        request.onsuccess = function () {
            if (callback) {
                if (context) callback = callback.bind(context);
                callback(document);
            }
        };

        request.onerror = function (event) {
            throw event.target.error.name + ': ' + event.target.error.message + ' "' + document._id + '"';
        };
    };

    this.remove = function (collectionName, _id, callback, context) {
        var store = this.getStore(collectionName, 'readwrite');
        var request = store.delete(_id);

        request.onsuccess = function () {
            if (callback) {
                if (context) callback = callback.bind(context);
                callback(_id);
            }
        };

        request.onerror = function () {
            console.warn('Could not remove document from storage');
        };
    };
}

module.exports = PersistentStorage;