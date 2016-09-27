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
var Toggle = require('react-bootstrap-toggle').default;

var Flex = require('virtool/js/components/Base/Flex.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');
var InputSave = require('virtool/js/components/Base/InputSave.jsx');

/**
 * A form component for setting whether an internal control should be used and which virus to use as a control.
 */
var HTTPOptions = React.createClass({

    toggle: function () {
        dispatcher.settings.set('use_ssl', !this.props.settingsData.use_ssl);
    },

    handleSave: function (data) {
        dispatcher.settings.set(data.name, data.value);
    },

    render: function () {
        return (
            <Panel>
                <div style={{marginBottom: "15px"}}>
                    <Flex.Item>
                        <Toggle
                            on="Enabled"
                            off="Disabled"
                            active={this.props.settingsData.use_ssl}
                            onChange={this.toggle}
                        />
                    </Flex.Item>
                </div>

                <InputSave
                    label='Certificate Path'
                    name='cert_path'
                    onSave={this.handleSave}
                    initialValue={this.props.settingsData.cert_path}
                    disabled={!this.props.settingsData.use_ssl}
                />

                <InputSave
                    label='Key Path'
                    name='key_path'
                    onSave={this.handleSave}
                    initialValue={this.props.settingsData.key_path}
                    disabled={!this.props.settingsData.use_ssl}
                />
            </Panel>
        );
    }

});

module.exports = HTTPOptions;
