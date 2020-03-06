import React from "react";
import styled from "styled-components";
import PropTypes from "prop-types";

import { Tooltip as TippyTooltip } from "react-tippy";
import "react-tippy/dist/tippy.css";

const StyledTooltip = styled(TippyTooltip)`
    display: inline-flex !important;
`;

export const Tooltip = ({ tip, position, children }) => {
    return (
        <StyledTooltip size="big" title={tip} arrow={true} position={position}>
            {children}
        </StyledTooltip>
    );
};

Tooltip.propTypes = {
    tip: PropTypes.string.isRequired,
    position: PropTypes.string,
    children: PropTypes.object.isRequired
};
