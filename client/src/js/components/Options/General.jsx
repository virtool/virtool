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

var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Alert = require('react-bootstrap/lib/Alert');
var Panel = require('react-bootstrap/lib/Panel');
var Button = require('react-bootstrap/lib/Button');

var SourceTypes = require('./General/SourceTypes.jsx');
var InternalControl = require('./General/InternalControl.jsx');
var UniqueNames = require('./General/UniqueNames.jsx');
var SamplePermissions = require('./General/SamplePermissions.jsx');


/**
 * A component the contains child components that modify certain general options. A small explanation of each
 * subcomponent is also rendered.
 */
var GeneralOptions = React.createClass({

    handleClick: function () {
        dispatcher.send({
            methodName: 'reload',
            collectionName: 'dispatcher',
            data: null
        }, this.onReloaded);
    },

    render: function () {

        return (
            <div>
                <Row>
                    <Col md={12}>
                        <h5><strong>Source Types</strong></h5>
                    </Col>
                    <Col md={6}>
                        <SourceTypes settings={dispatcher.settings} />
                    </Col>
                    <Col md={6}>
                        <Panel>
                            Configure a list of allowable source types. When a user creates a new isolate they will
                            only be able to select a source type from this list. If this feature is disabled, users will be
                            able to enter any string as a source type.
                        </Panel>
                    </Col>
                </Row>
                <Row>
                    <Col md={12}>
                        <h5><strong>Internal Control</strong></h5>
                    </Col>
                    <Col md={6}>
                        <InternalControl
                            settings={dispatcher.settings}
                            viruses={dispatcher.db.viruses}
                        />
                    </Col>
                    <Col md={6}>
                        <Panel>
                            Set a virus that is spiked into samples to be used as a positive control. Viral abundances
                            in a sample can be calculated as proportions relative to the control.
                        </Panel>
                    </Col>
                </Row>
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