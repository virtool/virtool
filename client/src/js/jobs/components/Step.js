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
            stateIcon = isDone ? "check fa-fw" : "";
            entryStyle = isDone ? "success" : "primary";
            break;

        case "complete":
            hasBar = false;
            stateIcon = "check fa-fw";
            entryStyle = "success";
            break;

        case "error":
        case "cancelled":
            hasBar = false;
            stateIcon = "times fa-fw";
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
                    : <div><ClipLoader size="14px" color="#07689d" style={{padding: "3px 2px"}} /></div>
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
