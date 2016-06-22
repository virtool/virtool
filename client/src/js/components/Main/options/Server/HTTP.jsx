/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports HTTPOptions
 */

'use strict';

var _ = require('lodash');
var React = require('react');
var Panel = require('react-bootstrap/lib/Panel');
var Input = require('react-bootstrap/lib/Input');

var InputSave = require('virtool/js/components/Base/InputSave.jsx');

/**
 * A form component for setting whether an internal control should be used and which virus to use as a control.
 */
var HTTPOptions = React.createClass({

    shouldComponentUpdate: function (nextProps) {
        return (
            this.props.settings.server_address != nextProps.settings.server_address,
            this.props.settings.server_port != nextProps.settings.server_port,
            this.props.settings.server_id != nextProps.settings.server_id
        );
    },

    handleSave: function (data) {
        dispatcher.settings.set(data.name, data.value);
    },

    render: function () {
        return (
            <Panel>
                <InputSave
                    name='server_address'
                    label='Address'
                    onSave={this.handleSave}
                    initialValue={this.props.settings.server_address}
                />
                <InputSave
                    name='server_port'
                    label='Port'
                    type='number'
                    onSave={this.handleSave}
                    initialValue={this.props.settings.server_port}
                />
                <Input
                    label='Server ID'
                    type='text'
                    value={this.props.settings.server_id}
                    disabled
                />
            </Panel>
        );
    }

});

module.exports = HTTPOptions;
