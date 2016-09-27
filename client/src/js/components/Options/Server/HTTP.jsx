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

var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Panel = require('react-bootstrap/lib/Panel');
var Input = require('react-bootstrap/lib/InputGroup');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var InputSave = require('virtool/js/components/Base/InputSave.jsx');

/**
 * A form component for setting whether an internal control should be used and which virus to use as a control.
 */
var HTTPOptions = React.createClass({

    handleSave: function (data) {
        dispatcher.settings.set(data.name, data.value);
    },

    render: function () {

        var footer = (
            <small className='text-warning'>
                <Icon name='warning' /> Changes to these settings will only take effect when the server is reloaded.
            </small>
        );

        return (
            <div>
                <Row>
                    <Col md={12}>
                        <h5><strong>HTTP Server</strong></h5>
                    </Col>
                </Row>
                <Row>
                    <Col md={6}>
                        <Panel>
                            <InputSave
                                name='server_address'
                                label='Address'
                                onSave={this.handleSave}
                                autoComplete={false}
                                initialValue={this.props.settingsData.server_address}
                            />
                            <InputSave
                                name='server_port'
                                label='Port'
                                type='number'
                                autoComplete={false}
                                onSave={this.handleSave}
                                initialValue={this.props.settingsData.server_port}
                            />
                            <Input
                                label='Server ID'
                                type='text'
                                autoComplete={false}
                                value={this.props.settingsData.server_id}
                                disabled
                            />
                        </Panel>
                    </Col>
                    <Col md={6}>
                        <Panel footer={footer}>
                            Change the address and port the the Virtool HTTP server listens on. The server ID uniquely
                            identifies the server to workstations that are connecting to multiple instances of Virtool
                            server.
                        </Panel>
                    </Col>
                </Row>
            </div>
        );
    }

});

module.exports = HTTPOptions;
