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

import React from "react";
import { Row, Col, Panel } from "react-bootstrap";
import { Flex, FlexItem, Icon } from 'virtool/js/components/Base';

var Limits = require('./Jobs/Limits');
var Tasks = require('./Jobs/Tasks');

/**
 * A component the contains child components that modify options for resource limits on the server and on specific
 * tasks.
 */
var JobOptions = React.createClass({
    render: function () {
        // A warning about disk-binding settings.
        var taskLimitFooter = (
            <Flex className='text-danger'>
                <FlexItem grow={0} shrink={0}>
                    <Icon name='warning' />
                </FlexItem>
                <FlexItem grow={1} pad>
                     Setting task-specific limits higher than system resource limits will prevent jobs from starting.
                </FlexItem>
            </Flex>
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