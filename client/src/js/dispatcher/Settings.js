/**
 * Copyright 2015, Government of Canada.
 * All rights reserved.
 *
 * This source code is licensed under the MIT license.
 *
 * @providesModule Settings *
 */

var Events = require("./Events");

var Settings = function () {

    this.events = new Events(['change'], this);

    // This object stores settings as key value pairs.
    this.data = {};

    /**
     * Called from the dispatcher when an update to the settings is received from the server. Updates any changed values
     * in the Settings object and emits an 'update' event to all listeners.
     *
     * @param data
     */
    this.update = function (data) {
        _.assign(this.data, data);
        this.emit('change');
    }.bind(this);

    /**
     * Sets a single setting key with a new value. The change is sent to the server and passed callbacks are called
     * when the operation succeeds or fails.
     *
     * @param key {string} The key whose corresponding value should be set.
     * @param value {*} - The new value.
     * @param success {function} - A function to be called if the operation completes successfully.
     * @param failure {function} - A function to be called if the operation fails.
     */
    this.set = function (key, value, success, failure) {
        // Make and object to send to the server with the structure {settingKey: newValue}.
        var data = {};
        data[key] = value;

        dispatcher.send({
            methodName: 'set',
            collectionName: 'settings',
            data: data
        }, success, failure);
    };

    /**
     * Get setting value by its key.
     *
     * @param key {string} - The settings key (eg. 'hostname').
     * @returns {*} - Returns the value labelled by the passed key.
     */
    this.get = function (key) {
        if (this.data.hasOwnProperty(key)) {
            // Return the setting value if the key exists in the settings object.
            return this.data[key];
        } else {
            // Log a warning if the key is not found.
            console.warn('Tried to get setting with unknown key "' + key + '"');
            return null;
        }
    };
};

module.exports = Settings;