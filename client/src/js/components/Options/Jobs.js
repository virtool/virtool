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

import React from "react";
import { Row, Col, Panel } from "react-bootstrap";
import { Flex, FlexItem, Icon } from "virtool/js/components/Base";

import SettingsProvider from "./SettingsProvider";
import Limits from "./Jobs/Limits";
import Tasks from "./Jobs/Tasks";

const TaskLimitFooter = () => (
    <Flex className="text-danger">
        <FlexItem grow={0} shrink={0}>
            <Icon name="warning" />
        </FlexItem>
        <FlexItem grow={1} pad>
             Setting task-specific limits higher than system resource limits will prevent jobs from starting.
        </FlexItem>
    </Flex>
);

/**
 * A component the contains child components that modify options for resource limits on the server and on specific
 * tasks.
 */
const JobOptionsInner = (props) => (
    <div>
        <Row>
            <Col md={12}>
                <h5><strong>Resource Limits</strong></h5>
            </Col>
            <Col md={6}>
                <Limits {...props} />
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
                <Tasks {...props} />
            </Col>
            <Col md={6}>
                <Panel footer={<TaskLimitFooter />}>
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
);

JobOptionsInner.propTypes = {
    set: React.PropTypes.func,
    settings: React.PropTypes.object
};

const JobOptions = () => (
    <SettingsProvider>
        <JobOptionsInner/>
    </SettingsProvider>
);

export default JobOptions;
