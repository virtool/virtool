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

import React from "react";
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Panel = require('react-bootstrap/lib/Panel');
var Icon = require('virtool/js/components/Base/Icon');

var HTTP = require('./Server/HTTP');
var Security = require('./Server/Security');
var Lifecycle = require('./Server/Lifecycle');

/**
 * A component the contains child components that modify certain general options. A small explanation of each
 * subcomponent is also rendered.
 */
var ServerOptions = React.createClass({

    getInitialState: function () {
        return {
            settingsData: dispatcher.settings.data
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
        return (
            <div>
                <HTTP settingsData={this.state.settingsData} />
                <Security settingsData={this.state.settingsData} />

                <Row>
                    <Col md={12}>
                        <h5><strong>Lifecycle Controls</strong></h5>
                    </Col>
                    <Col md={6}>
                        <Lifecycle settingsData={this.state.settingsData} />
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