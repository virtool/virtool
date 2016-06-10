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

var Checkbox = require('virtool/js/components/Base/Checkbox.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');
var InputSave = require('virtool/js/components/Base/InputSave.jsx');

/**
 * A form component for setting whether an internal control should be used and which virus to use as a control.
 */
var HTTPOptions = React.createClass({

    toggle: function () {
        dispatcher.settings.set('use_ssl', !this.props.settings.use_ssl);
    },

    handleSave: function (data) {
        dispatcher.settings.set(data.name, data.value);
    },

    render: function () {
        return (
            <Panel>
                <p style={{cursor: 'pointer'}} onClick={this.toggle}>
                    <Checkbox checked={this.props.settings.use_ssl} /> Use SSL
                </p>

                <InputSave
                    label='Certificate Path'
                    name='cert_path'
                    onSave={this.handleSave}
                    initialValue={this.props.settings.cert_path}
                    disabled={!this.props.settings.use_ssl}
                />

                <InputSave
                    label='Key Path'
                    name='key_path'
                    onSave={this.handleSave}
                    initialValue={this.props.settings.key_path}
                    disabled={!this.props.settings.use_ssl}
                />
            </Panel>
        );
    }

});

module.exports = HTTPOptions;
