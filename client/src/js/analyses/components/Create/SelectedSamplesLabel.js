import React from "react";
import { Badge } from "../../../base";

export const SelectedSamplesLabel = ({ count }) => {
    let tail;

    if (count > 1) {
        tail = (
            <React.Fragment>
                s <Badge>{count}</Badge>
            </React.Fragment>
        );
    }

    return <label>Sample{tail}</label>;
};
