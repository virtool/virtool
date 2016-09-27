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
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Panel = require('react-bootstrap/lib/Panel');
var Toggle = require('react-bootstrap-toggle').default;

var Icon = require('virtool/js/components/Base/Icon.jsx');
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

        var footer = (
            <small className='text-warning'>
                <Icon name="warning" /> Changes to these settings will only take effect when the server is reloaded.
            </small>
        );

        return (
            <div>
                <Row>
                    <Col md={6}>
                        <Flex alignItems="center" style={{marginBottom: "10px"}}>
                            <Flex.Item grow={1}>
                                <strong>SSL</strong>
                            </Flex.Item>
                            <Flex.Item>
                                <Toggle
                                    on="ON"
                                    off="OFF"
                                    size="small"
                                    active={this.props.settingsData.use_ssl}
                                    onChange={this.toggle}
                                />
                            </Flex.Item>
                        </Flex>
                    </Col>
                    <Col md={6} />
                </Row>
                <Row>
                    <Col md={6}>
                        <Panel>
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
                    </Col>
                    <Col md={6}>
                        <Panel footer={footer}>
                            Configure the server to use SSL.
                        </Panel>
                    </Col>
                </Row>
            </div>
        );
    }

});

module.exports = HTTPOptions;
