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

var _ = require('lodash');
var React = require('react');
var Panel = require('react-bootstrap/lib/Panel');

var InputSave = require('virtool/js/components/Base/InputSave.jsx');

/**
 * A form component for setting whether an internal control should be used and which virus to use as a control.
 */
var Limits = React.createClass({

    getInitialState: function () {
        return {settings: this.props.settings.data};
    },

    componentDidMount: function () {
        this.props.settings.on('change', this.update);
    },

    componentWillUnmount: function () {
        this.props.settings.off('change', this.update);
    },

    /**
     * Update the proc setting with a new value by sending a request to the server.
     *
     * @param newValue {number} - the new value to set the proc setting to.
     * @func
     */
    handleSaveProc: function (newValue) {
        this.props.settings.set('proc', newValue);
    },

    /**
     * Update the mem setting with a new value by sending a request to the server.
     *
     * @param newValue {number} - the new value to set the mem setting to.
     * @func
     */
    handleSaveMem: function (newValue) {
        this.props.settings.set('mem', newValue);
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
