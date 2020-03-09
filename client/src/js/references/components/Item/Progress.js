import React from "react";
import styled from "styled-components";
import { TopProgressBar } from "../../../base";

const ReferenceItemProgressPlaceholder = styled.div`
    height: 4px;
    width: 100%;
`;

export const ReferenceItemProgress = ({ now }) => {
    if (now === 100) {
        return <ReferenceItemProgressPlaceholder />;
    }

    return <TopProgressBar marginBottom="none" bsStyle="warning" now={now} />;
};
