import React from "react";
import styled from "styled-components";
import { format } from "date-fns";
import { BoxGroupSection, Icon, Loader } from "../../base";
import { getStepDescription } from "../utils";

const StyledJobStepTimestamp = styled.div`
    align-items: center;
    display: flex;
    margin-top: 10px;

    i:not(:first-child) {
        padding-left: 10px;
    }

    & > span {
        padding-left: 5px;
    }
`;

const JobStepLoader = styled(Loader)`
    padding: 0 1.5px;
`;

const JobStepTimestamp = ({ timestamp }) => (
    <StyledJobStepTimestamp>
        <Icon name="clock" />
        <span>{format(new Date(timestamp), "hh:mm:ss")}</span>
        <Icon name="calendar" />
        <span>{format(new Date(timestamp), "yyyy-MM-dd")}</span>
    </StyledJobStepTimestamp>
);

const StyledJobStepDescription = styled.div`
    display: flex;
    flex-direction: column;

    > h4 {
        font-size: ${props => props.theme.fontSize.lg};
        font-weight: bold;
        margin: 0 0 4px;
    }

    > p {
        color: ${props => props.theme.color.greyDarkest};
        margin: 0 0 3px;
    }
`;

export const JobStepDescription = ({ stage, state, task, timestamp }) => {
    const { description, title } = getStepDescription(stage, state, task);

    return (
        <StyledJobStepDescription>
            <h4>{title}</h4>
            <p>{description}</p>
            <JobStepTimestamp timestamp={timestamp} />
        </StyledJobStepDescription>
    );
};

export const JobStepIcon = ({ complete, state }) => {
    if (state === "waiting") {
        return <Icon name="pause" color="purple" fixedWidth />;
    }

    if (complete) {
        return <Icon name="arrow-circle-down" color="blue" fixedWidth />;
    }

    if (state === "running") {
        return <JobStepLoader size="12px" color="#07689d" />;
    }

    if (state === "complete") {
        return <Icon name="check" color="green" fixedWidth />;
    }

    if (state === "error") {
        return <Icon name="times" color="red" fixedWidth />;
    }

    if (state === "cancelled") {
        return <Icon name="ban" color="red" fixedWidth />;
    }
};

const JobStepIconContainer = styled.div`
    align-items: center;
    display: flex;
    height: 16px;
    margin-right: 4px;
    padding-top: 3px;
    width: 16px;
`;

const StyledJobStep = styled(BoxGroupSection)`
    align-items: flex-start;
    display: flex;
`;

const JobStep = ({ complete, step, task }) => (
    <StyledJobStep>
        <JobStepIconContainer>
            <JobStepIcon state={step.state} complete={complete} />
        </JobStepIconContainer>
        <JobStepDescription {...step} task={task} />
    </StyledJobStep>
);

export default JobStep;
