/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Task
 */

'use strict';

var _ = require('lodash');
import React from "react";
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');

var TaskField = require('./TaskField');

/**
 * A ListGroupItem-based form component that allows editing of task-specific resource limits in form child components.
 */
var Task = React.createClass({

    propTypes: {
        taskPrefix: React.PropTypes.string.isRequired
    },

    render: function () {
        var readOnly = _.includes(['add_host', 'rebuild_index'], this.props.taskPrefix);

        var displayName;

        switch (this.props.taskPrefix) {

            case 'nuvs':
                displayName = 'NuVs';
                break;

            case 'pathoscope_bowtie':
                displayName = 'PathoscopeBowtie';
                break;

            case 'pathoscope_snap':
                displayName = 'PathoscopeSNAP';
                break;

            default:
                displayName =_.startCase(this.props.taskPrefix);
                break;
        }

        return (
            <ListGroupItem>
                <h5><strong>{displayName}</strong></h5>
                <Row>
                    <Col md={4}>
                        <TaskField
                            {...this.props}
                            resource='proc'
                            readOnly={readOnly}
                        />
                    </Col>
                    <Col md={4}>
                        <TaskField
                            {...this.props}
                            resource='mem'
                            readOnly={readOnly}
                        />
                    </Col>
                    <Col md={4}>
                        <TaskField
                            {...this.props}
                            resource='inst'
                            readOnly={this.props.taskPrefix === 'rebuild_index'}
                        />
                    </Col>
                </Row>
            </ListGroupItem>
        );
    }

});

module.exports = Task;