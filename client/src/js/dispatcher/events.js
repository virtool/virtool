/**
 * Copyright 2015, Government of Canada.
 * All rights reserved.
 *
 * This source code is licensed under the MIT license.
 *
 * @providesModule Events *
 */

import { transform, remove, each } from "lodash";

/**
 * A simple event managing object that can be bound into other objects to make them capable of managing callback and
 * emitting events.
 *
 * @param eventTypes {array} - An array of event names that can be bound and emitted by the Events object.
 * @param parent {object} - A parent object to forward the on, off, and emit functions to.
 * @class
 */
class Events {

    constructor (eventTypes, parent) {

        // Add a property to this.bound for each event type. The key is the eventType and the value is a list that will
        // all bound callbacks for that eventType.
        this.bound = transform(eventTypes, (result, eventType) => result[eventType] = [], {});

        // Bind the following function to a passed parent object to make it directly able to emit events and bind
        // callbacks. Bind the methods to the Events object.
        if (parent) {
            parent.on = this.on.bind(this);
            parent.off = this.off.bind(this);
            parent.emit = this.emit.bind(this);
        }
    }

    /**
     * Bind a callback to an event.
     *
     * @param event {string} - The event to bind the callback to.
     * @param callback {function} - The function to call when the event is emitted.
     * @func
     */
    on (event, callback) {
        if (this.bound.hasOwnProperty(event)) {
            this.bound[event].push(callback);
        } else {
            throw new Error(`Attempted to bind callback to non-existent event "${event}"`);
        }
    }

    /**
     * Unbind a callback from an event.
     *
     * @param event {string} - The event the callback should be unbound from.
     * @param callback {function} - The callback that should be unbound.
     * @func
     */
    off (event, callback) {
        remove(this.bound[event], (candidateCallback) => callback === candidateCallback);
    }

    /**
     * Emits and event. This entails calling every callback function that is bound to the event. Optional data can be
     * passed as an argument to the callback.
     *
     * @param events {array} the name of the event to emit.
     * @param data {object} a data object that can be passed to the bound callbacks when they are called.
     * @func
     */
    emit (events, data) {
        const eventsArray = events instanceof Array ? events: [events];
        eventsArray.forEach((event) => each(this.bound[event], (callback) => callback(data)));
    }
}

export default Events;
