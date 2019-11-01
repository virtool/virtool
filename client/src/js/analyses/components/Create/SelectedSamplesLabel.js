import React from "react";
import { Badge } from "react-bootstrap";

export const SelectedSamplesLabel = ({ count }) => {
    let tail;

    if (count > 1) {
        tail = (
            <React.Fragment>
                s <Badge>{count}</Badge>
            </React.Fragment>
        );
    }

    return <label className="control-label">Sample{tail}</label>;
};
