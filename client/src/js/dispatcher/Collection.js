/**
 * Copyright 2015, Government of Canada.
 * All rights reserved.
 *
 * This source code is licensed under the MIT license.
 *
 * @providesModule Collection *
 */

'use strict';

var _ = require('lodash');
var Dexie = require('dexie');
var Events = require('./Events.js');

/**
 * An extension of AlertModal which confirms actions being performed on one more target documents identified by _ids.
 * The action is provided to the component as a function (onAccept) that will be called when the accept button is
 * clicked.
 *
 * @class
 */
var Collection = function Collection(name, useStorage) {

    this.name = name;
    this.useStorage = useStorage === undefined ? true: useStorage;

    // Collection is a basis for constructing stores of documents for each data collection.
    this.events = new Events(['change', 'add', 'update', 'remove'], this);

    // The document objects that are managed by the collection.
    this.documents = [];

    // This value is set to 'true' when the server has finished sending updates to the collection after syncing.
    this.synced = false;

    // If this property is set to true, all documents in the collection will be stored in indexedDB. The collection
    // will also be restored from indexedDB and updated from the server, rather than loading all of the documents
    // from the server, every time the client application is refreshed.
    if (this.useStorage === undefined) this.useStorage = true;

    this.request = function (operation, data, success, failure) {
        dispatcher.send({
            methodName: operation,
            collectionName: this.name,
            data: data
        }, success, failure);
    };

    /**
     * Creates a object where each property is a document version keyed by the corresponding id.
     *
     * @returns {{object}}
     */
    this.manifest = function () {
        var manifest = {};

        _.each(this.documents, function (document) {
            manifest[document._id] = document._version;
        });

        return manifest;
    };

    /**
     * Gets a collection document by _id.
     *
     * @param _id {string} - The _id of the document to retrieve.
     * @returns {*} - The collection document object associated with the passed _id.
     */
    this.get = function (_id) {
        return _.find(this.documents, {_id: _id});
    };

    /**
     * Update one or more documents based on updates defined by an object or an array of objects. Each object that
     * describes an update must contain an '_id' field to target the update against a specific document. If any
     * documents are successful an 'update' event is emitted to all listeners.
     *
     * @param updates {object|array} - the update(s) to perform on the collection.
     * @param sync {bool} - the update is part of a sync operation.
     * @func
     */
    this.update = function (updates, sync) {

        // Force the update data into an Array. This can be a single-member array.
        if (updates.constructor !== Array) updates = [updates];

        var successfulUpdates = [];
        var operationCount = updates.length;
        var completedCount = 0;

        var onSuccess = function (document) {
            successfulUpdates.push(document);
            completedCount += 1;

            if (completedCount === operationCount) {
                this.emit(['change', 'update'], successfulUpdates);
            }

            if (sync) dispatcher.runningOperationCount += 1;
        }.bind(this);

        _.forEach(updates, function (update) {
            var document = _.find(this.documents, {_id: update._id});

            if (document) {
                _.assign(document, update);
            } else {
                document = update;
                this.documents.push(document);
            }

            // Add the updated version of the document to indexedDB.
            this.useStorage ? dispatcher.storage.add(this.name, document, onSuccess): onSuccess(document);

        }.bind(this));

        if (successfulUpdates.length > 0) {
            this.emit(['change', 'update'], successfulUpdates);
        }
    };

    /**
     * Remove a document based on a passed object. Currently, the only supported property to remove by is '_id'. An
     * 'update' event is emitted if an document is successfully removed.
     *
     * @param data {object} - An object containing describing the object to be removed.
     * @param sync {bool} - the removal is part of a sync operation.
     * @func
     */
    this.remove = function (data, sync) {
        var documentIds = data;

        if (documentIds.constructor !== Array) documentIds = [documentIds];

        var existingDocumentIds = _.map(this.documents, '_id');

        var invalidDocumentIds = _.remove(documentIds, function (documentId) {
            return existingDocumentIds.indexOf(documentId) === -1;
        });

        if (invalidDocumentIds.length > 0) {
            console.warn('Attempted to remove nonexistent document(s) in "' + this.name + '": ' + invalidDocumentIds);
        }

        var completedCount = 0;
        var operationCount = documentIds.length;
        
        var onSuccess = function () {
            completedCount += 1;

            if (completedCount === operationCount) {
                var removed = _.remove(this.documents, function (document) {
                    return documentIds.indexOf(document._id) > -1;
                });

                this.emit(['change', 'remove'], removed);

                if (sync) dispatcher.runningOperationCount += 1;
            }
        }.bind(this);

        // Remove the document from the documents array.


        if (this.useStorage) {
            _.forEach(documentIds, function (documentId) {
                dispatcher.storage.remove(this.name, documentId, onSuccess);
            }.bind(this));
        } else {
            onSuccess();
        }
    };
};

module.exports = Collection;