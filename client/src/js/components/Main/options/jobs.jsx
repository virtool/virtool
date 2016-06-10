/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports JobOptions
 */

'use strict';

var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Alert = require('react-bootstrap/lib/Alert');
var Panel = require('react-bootstrap/lib/Panel');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Limits = require('./Jobs/Limits.jsx');
var Tasks = require('./Jobs/Tasks.jsx');

/**
 * A component the contains child components that modify options for resource limits on the server and on specific
 * tasks.
 */
var JobOptions = React.createClass({
    render: function () {
        // A warning about disk-binding settings.
        var taskLimitFooter = (
            <span className='text-warning'>
                <Icon name='warning' /> Allowing too many concurrent jobs for IO-intensive tasks can reduce performance.
            </span>
        );

        return (
            <div>
                <Row>
                    <Col md={12}>
                        <h5><strong>Resource Limits</strong></h5>
                    </Col>
                    <Col md={6}>
                        <Limits settings={dispatcher.settings} />
                    </Col>
                    <Col md={6}>
                        <Panel>
                            Set limits on the computing resources Virtool can use on the host server.
                        </Panel>
                    </Col>
                </Row>
                <Row>
                    <Col md={12}>
                        <h5><strong>Task-specific Limits</strong></h5>
                    </Col>
                    <Col md={6}>
                        <Tasks settings={dispatcher.settings} />
                    </Col>
                    <Col md={6}>
                        <Panel footer={taskLimitFooter}>
                            <p>Set limits on specific tasks:</p>
                            <ul>
                                <li>number of CPU cores to dedicate to each job</li>
                                <li>amount of memory to dedicate to each job</li>
                                <li>maximum number of concurrent jobs</li>
                            </ul>
                            Changing CPU and memory settings will not affect jobs that have already been initialized.
                        </Panel>
                    </Col>
                </Row>
            </div>
        )
    }
});

module.exports = JobOptions;