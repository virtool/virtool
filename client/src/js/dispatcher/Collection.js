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
var Events = require('./Events.js');

/**
 * An extension of AlertModal which confirms actions being performed on one more target documents identified by _ids.
 * The action is provided to the component as a function (onAccept) that will be called when the accept button is
 * clicked.
 *
 * @class
 */
var Collection = function Collection(name, db, options) {

    this.name = name;
    this.db = db;

    this.lokiCollection = db.loki.addCollection(name, options);

    // Collection is a basis for constructing stores of documents for each data collection.
    this.events = new Events(['change', 'add', 'update', 'remove'], this);

    // This value is set to 'true' when the server has finished sending updates to the collection after syncing.
    this.synced = false;



    /**
     * Update one or more documents based on updates defined by an object or an array of objects. Each object that
     * describes an update must contain an '_id' field to target the update against a specific document. If any
     * documents are successful an 'update' event is emitted to all listeners.
     *
     * @param updates {object|array} - the update(s) to perform on the collection.
     * @func
     */
    this.update = function (updates) {

        // Force the update data into an Array. This can be a single-member array.
        if (updates.constructor !== Array) updates = [updates];

        this.lokiCollection.bulkPut(updates).then(function () {
            this.emit(['change', 'update'], updates);
        });
    };

    /**
     * Remove a document based on a passed object. Currently, the only supported property to remove by is '_id'. An
     * 'update' event is emitted if an document is successfully removed.
     *
     * @param documentIds {object} - An object containing describing the object to be removed.
     * @func
     */
    this.remove = function (documentIds) {
        // Remove the document from the documents array.
        this.table.bulkDelete(documentIds).then(function () {
            this.emit(['change', 'remove'], removed);
        });
    };
};

module.exports = Collection;