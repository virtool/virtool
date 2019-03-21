import Moment from "moment";
import React from "react";
import { ListGroupItem } from "react-bootstrap";
import { Flex, FlexItem, Icon, Loader } from "../../base";
import { getStepDescription } from "../utils";

export const JobStepDescription = ({ stage, state, task }) => {
    const { description, title } = getStepDescription(stage, state, task);

    return (
        <div>
            <div>
                <strong>{title}</strong>
            </div>
            <small className="text-muted">{description}</small>
        </div>
    );
};

export const JobStepIcon = ({ complete, state }) => {
    if (state === "waiting") {
        return <Icon name="pause" bsStyle="info" fixedWidth />;
    }

    if (complete) {
        return <Icon name="arrow-circle-down" bsStyle="primary" fixedWidth />;
    }

    if (state === "running") {
        return <Loader size="12px" color="#07689d" style={{ padding: "0 1.5px" }} />;
    }

    if (state === "complete") {
        return <Icon name="check" bsStyle="success" fixedWidth />;
    }

    if (state === "error") {
        return <Icon name="times" bsStyle="danger" fixedWidth />;
    }

    if (state === "cancelled") {
        return <Icon name="ban" bsStyle="danger" fixedWidth />;
    }
};

const JobStep = ({ complete, step, task }) => (
    <ListGroupItem>
        <Flex alignItems="flex-start">
            <FlexItem>
                <JobStepIcon state={step.state} complete={complete} />
            </FlexItem>
            <FlexItem pad={12}>
                <JobStepDescription {...step} task={task} />
                <Flex alignItems="center" style={{ marginTop: "10px" }}>
                    <FlexItem>
                        <Icon name="clock" fixedWidth />
                    </FlexItem>
                    <FlexItem pad={10}>{Moment(step.timestamp).format("hh:mm:ss")}</FlexItem>
                    <FlexItem pad={10}>
                        <Icon name="calendar" fixedWidth />
                    </FlexItem>
                    <FlexItem pad={10}>{Moment(step.timestamp).format("YYYY-MM-DD")}</FlexItem>
                </Flex>
            </FlexItem>
        </Flex>
    </ListGroupItem>
);

export default JobStep;
