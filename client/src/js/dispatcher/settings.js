/**
 * Copyright 2015, Government of Canada.
 * All rights reserved.
 *
 * This source code is licensed under the MIT license.
 *
 * @providesModule Settings *
 */

import { assign } from "lodash";
import Events from "./events";

export default class Settings {

    constructor () {
        this.events = new Events(["change"], this);

        // This object stores settings as key value pairs.
        this.data = {};
    }

    /**
     * Called from the dispatcher when an update to the settings is received from the server. Updates any changed values
     * in the Settings object and emits an 'update' event to all listeners.
     *
     * @param data
     */
    update = (data) => {
        assign(this.data, data);
        this.emit("change");
    };

    /**
     * Sets a single setting key with a new value. The change is sent to the server and passed callbacks are called
     * when the operation succeeds or fails.
     *
     * @param key {string} The key whose corresponding value should be set.
     * @param value {*} - The new value.
     */
    set = (key, value) => {
        // Make and object to send to the server with the structure {settingKey: newValue}.
        let data = {};
        data[key] = value;

        return dispatcher.send({
            interface: "settings",
            method: "set",
            data: data
        });
    };

    /**
     * Get setting value by its key.
     *
     * @param key {string} - The settings key (eg. 'hostname').
     * @returns {*} - Returns the value labelled by the passed key.
     */
    get = (key) => {
        if (this.data.hasOwnProperty(key)) {
            // Return the setting value if the key exists in the settings object.
            return this.data[key];
        }
    };
}
