import React from "react";
import { Icon, Loader } from "../../base";

export const JobActionIcon = ({ state, canCancel, canRemove, onCancel, onRemove }) => {
    if ((state === "waiting" || state === "running") && canCancel) {
        return <Icon bsStyle="danger" name="ban" onClick={onCancel} style={{ fontSize: "17px" }} pullRight />;
    } else if (canRemove) {
        return <Icon bsStyle="danger" name="trash" onClick={onRemove} style={{ fontSize: "17px" }} pullRight />;
    }

    return null;
};

export const JobStatusIcon = ({ state }) => {
    if (state === "waiting" || state === "running") {
        return <Loader size="14px" color="#3c8786" />;
    }

    if (state === "complete") {
        return <Icon name="check fa-fw" bsStyle="success" />;
    }

    if (state === "error" || state === "cancelled") {
        return <Icon name="times fa-fw" bsStyle="danger" />;
    }

    return null;
};
