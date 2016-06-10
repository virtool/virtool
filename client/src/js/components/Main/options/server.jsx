/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ServerOptions
 */

'use strict';

var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Panel = require('react-bootstrap/lib/Panel');
var Icon = require('virtool/js/components/Base/Icon.jsx');

var HTTP = require('./Server/HTTP.jsx');
var Security = require('./Server/Security.jsx');
var Lifecycle = require('./Server/Lifecycle.jsx');

/**
 * A component the contains child components that modify certain general options. A small explanation of each
 * subcomponent is also rendered.
 */
var ServerOptions = React.createClass({

    getInitialState: function () {
        return {
            settings: dispatcher.settings.data
        };
    },

    componentDidMount: function () {
        dispatcher.settings.on('change', this.update);
    },

    componentWillUnmount: function () {
        dispatcher.settings.off('change', this.update);
    },

    update: function () {
        this.setState(this.getInitialState());
    },

    render: function () {

        var reloadFooter = (
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
                    <Col md={6}>
                        <HTTP settings={this.state.settings} />
                    </Col>
                    <Col md={6}>
                        <Panel footer={reloadFooter}>
                            Change the address and port the the Virtool HTTP server listens on. The server ID uniquely
                            identifies the server to workstations that are connecting to multiple instances of Virtool
                            server.
                        </Panel>
                    </Col>
                </Row>

                <Row>
                    <Col md={12}>
                        <h5><strong>SSL</strong></h5>
                    </Col>
                    <Col md={6}>
                        <Security settings={this.state.settings} />
                    </Col>
                    <Col md={6}>
                        <Panel footer={reloadFooter}>
                            Configure the server to use SSL.
                        </Panel>
                    </Col>
                </Row>

                <Row>
                    <Col md={12}>
                        <h5><strong>Lifecycle Controls</strong></h5>
                    </Col>
                    <Col md={6}>
                        <Lifecycle settings={this.state.settings} />
                    </Col>
                    <Col md={6}>
                        <Panel>
                            Reload the server settings and clear connections or shutdown the server completely.
                        </Panel>
                    </Col>
                </Row>
            </div>
        )
    }
});

module.exports = ServerOptions;