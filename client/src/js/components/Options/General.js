/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports GeneralOptions
 */

'use strict';

import React from "react";
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Alert = require('react-bootstrap/lib/Alert');
var Panel = require('react-bootstrap/lib/Panel');
var Button = require('react-bootstrap/lib/Button');

var SourceTypes = require('./General/SourceTypes');
var InternalControl = require('./General/InternalControl');
var UniqueNames = require('./General/UniqueNames');
var SamplePermissions = require('./General/SamplePermissions');


/**
 * A component the contains child components that modify certain general options. A small explanation of each
 * subcomponent is also rendered.
 */
var GeneralOptions = React.createClass({

    handleClick: function () {
        dispatcher.send({
            interface: 'dispatcher',
            method: 'reload',
            data: null
        }, this.onReloaded);
    },

    render: function () {

        return (
            <div>
                <SourceTypes settings={dispatcher.settings} />

                <InternalControl
                    settings={dispatcher.settings}
                    viruses={dispatcher.db.viruses}
                />

                <Row>
                    <Col md={12}>
                        <h5><strong>Unique Sample Names</strong></h5>
                    </Col>
                    <Col md={6}>
                        <UniqueNames />
                    </Col>
                    <Col md={6}>
                        <Panel>
                            Enable this feature to ensure that every created sample has a unique name. If a user
                            attempts to assign an existing name to a new sample an error will be displayed.
                        </Panel>
                    </Col>
                </Row>
                <Row>
                    <Col md={12}>
                        <h5><strong>Default Sample Permissions</strong></h5>
                    </Col>
                    <Col md={6}>
                        <SamplePermissions />
                    </Col>
                    <Col md={6}>
                        <Panel>
                            Set the method used to assign groups to new samples and the default rights.
                        </Panel>
                    </Col>
                </Row>
            </div>
        )
    }
});

module.exports = GeneralOptions;