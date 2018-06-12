import React from "react";
import { Flex, FlexItem, Icon, ClipLoader } from "../../base";
import { getTaskDisplayName } from "../../utils";

const JobStep = ({ step, isDone }) => {

    let hasBar;
    let stateIcon;
    let entryStyle;

    switch (step.state) {

        case "running":
            hasBar = (step.progress === 100) ? false : true;
            stateIcon = isDone ? "check" : "spinner";
            entryStyle = isDone ? "success" : "primary";
            break;

        case "complete":
            hasBar = false;
            stateIcon = "check";
            entryStyle = "success";
            break;

        case "error":
            hasBar = false;
            stateIcon = "times";
            entryStyle = "danger";
            break;

        default:
            return null;

    }

    const stepEntry = (
        <div className="step-entry">
            <Icon name={stateIcon} bsStyle={entryStyle} />
            <div
                className={hasBar ? "step-entry-bar" : "step-entry-nobar"}
                style={{ borderColor: isDone ? "green" : "blue" }}
            />
            <div className="step-entry-content">
                {getTaskDisplayName(step.stage)}
            </div>
        </div>
    );

    return stepEntry;
};

export default JobStep;
