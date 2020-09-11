import React from "react";
import styled from "styled-components";
import { Icon } from "../../../base";

const JobActionOverlay = styled.div`
    background-color: transparent;
    font-size: 17px;
    padding: 15px 15px 0;
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 20;
`;

export const JobAction = ({ state, canCancel, canRemove, onCancel, onRemove }) => {
    if (state === "waiting" || state === "running") {
        if (canCancel) {
            return (
                <JobActionOverlay>
                    <Icon color="red" name="ban" onClick={onCancel} />
                </JobActionOverlay>
            );
        }

        return null;
    }

    if (canRemove) {
        return (
            <JobActionOverlay>
                <Icon color="red" name="trash" onClick={onRemove} />
            </JobActionOverlay>
        );
    }

    return null;
};
