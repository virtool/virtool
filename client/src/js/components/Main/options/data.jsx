/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports DataOptions
 */

'use strict';

var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Panel = require('react-bootstrap/lib/Panel');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Database = require('./Data/Database.jsx');
var Paths = require('./Data/Paths.jsx');

/**
 * A component the contains child components that modify certain general options. A small explanation of each
 * subcomponent is also rendered.
 */
var DataOptions = React.createClass({

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

        var warningFooter = (
            <small className='text-danger'>
                <Icon name='warning' /> Changing these settings can make Virtool non-functional
            </small>
        );

        return (
            <div>
                <Row>
                    <Col md={12}>
                        <h5><strong>Database</strong></h5>
                    </Col>
                    <Col md={6}>
                        <Database settings={this.state.settings} />
                    </Col>
                    <Col md={6}>
                        <Panel footer={warningFooter}>
                            Change the parameters for connecting to MongoDB.
                        </Panel>
                    </Col>
                </Row>
                <Row>
                    <Col md={12}>
                        <h5><strong>Paths</strong></h5>
                    </Col>
                    <Col md={6}>
                        <Paths settings={this.state.settings} />
                    </Col>
                    <Col md={6}>
                        <Panel footer={warningFooter}>
                            Set the paths where Virtool looks for its data files and for FASTQ files to import.
                        </Panel>
                    </Col>
                </Row>
            </div>
        )
    }
});

module.exports = DataOptions;