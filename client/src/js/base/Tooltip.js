import React from "react";
import styled from "styled-components";
import { Tooltip } from "react-tippy";
import "react-tippy/dist/tippy.css";

const StyledTooltip = styled(Tooltip)`
    display: inline-flex !important;
`;

export const TippyTooltip = props => {
    return (
        <StyledTooltip size="big" title={props.tip} arrow={true} position={props.position}>
            {props.children}
        </StyledTooltip>
    );
};
