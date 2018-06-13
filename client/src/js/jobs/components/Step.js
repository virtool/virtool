import React from "react";
import { ClipLoader } from "halogenium";
import { Icon } from "../../base";
import { getTaskDisplayName } from "../../utils";

const JobStep = ({ step, isDone }) => {

    let hasBar;
    let stateIcon;
    let entryStyle;

    switch (step.state) {

        case "running":
            hasBar = isDone;
            stateIcon = isDone ? "check" : "";
            entryStyle = isDone ? "success" : "primary";
            break;

        case "complete":
            hasBar = false;
            stateIcon = "check";
            entryStyle = "success";
            break;

        case "error":
        case "cancelled":
            hasBar = false;
            stateIcon = "times";
            entryStyle = "danger";
            break;

        default:
            return null;

    }

    const stepEntry = (
        <div className="step-entry">
            <div className="step-entry-icon">
                {stateIcon.length
                    ? <Icon name={stateIcon} bsStyle={entryStyle} />
                    : <ClipLoader size="12px" color="#07689d" />
                }
            </div>
            <div className="step-entry-content">
                {getTaskDisplayName(step.stage)}
            </div>
            <div
                className={hasBar ? `step-entry-bar-${entryStyle}` : "step-entry-nobar"}
            />
        </div>
    );

    return stepEntry;
};

export default JobStep;
