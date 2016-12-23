/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Limits
 */

'use strict';

import React from "react";
var Panel = require('react-bootstrap/lib/Panel');

var InputSave = require('virtool/js/components/Base/InputSave');

/**
 * A form component for setting whether an internal control should be used and which virus to use as a control.
 */
var Limits = React.createClass({

    getInitialState: function () {
        return {settings: dispatcher.settings.data};
    },

    componentDidMount: function () {
        dispatcher.settings.on('change', this.update);
    },

    componentWillUnmount: function () {
        dispatcher.settings.off('change', this.update);
    },

    /**
     * Update the proc setting with a new value by sending a request to the server.
     *
     * @param saveEvent {number} - an object containing the new value to set the proc setting to.
     * @func
     */
    handleSaveProc: function (saveEvent) {
        dispatcher.settings.set('proc', saveEvent.value);
    },

    /**
     * Update the mem setting with a new value by sending a request to the server.
     *
     * @param saveEvent {number} - an object containing the new value to set the mem setting to.
     * @func
     */
    handleSaveMem: function (saveEvent) {
        dispatcher.settings.set('mem', saveEvent.value);
    },

    /**
     * Refreshes the component state from the dispatcher settings object. Triggered when the settings object emits an
     * update event.
     *
     * @func
     */
    update: function () {
        this.setState(this.getInitialState());
    },

    render: function () {
        return (
            <Panel>
                <InputSave
                    label='CPU Limit'
                    type='number'
                    onSave={this.handleSaveProc}
                    initialValue={this.state.settings.proc}
                />
                <InputSave
                    label='Memory Limit (GB)'
                    type='number'
                    onSave={this.handleSaveMem}
                    initialValue={this.state.settings.mem}
                />
            </Panel>
        );
    }

});

module.exports = Limits;
