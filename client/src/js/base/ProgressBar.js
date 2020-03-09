import React from "react";
import styled from "styled-components";

const progressValueColor = {
    success: "#60af98",
    warning: "#be9235",
    danger: "#af3227",
    blue: "rgb(7, 104, 157)"
};

const StyledProgress = styled.progress`
    -webkit-appearance: none;
    height: 20px;
    margin-bottom: 10px;
    width: 100%;

    ::-webkit-progress-value {
        ${props => {
            return `
            background-color: ${progressValueColor[props.bsStyle]};
          `;
        }}
    }

    ::-webkit-progress-bar {
        background-color: #f5f5f5;
    }
`;

const StyledAffixedProgress = styled(StyledProgress)`
    height: 5px;
    position: absolute;

    top: 0;
    left: 0;

    ::-webkit-progress-bar {
        background-color: transparent;
    }
`;

const StyledTopProgressBar = styled(StyledProgress)`
    height: 4px;
    display: flex;
    margin-bottom: ${props => (props.marginBottom === "none" ? 0 : "10px")};

    ::-webkit-progress-bar {
        background-color: transparent;
    }
`;

export const AffixedProgressBar = ({ now, bsStyle }) => {
    return <StyledAffixedProgress max="100" value={now} bsStyle={bsStyle}></StyledAffixedProgress>;
};

export const ProgressBar = ({ now, bsStyle }) => {
    return <StyledProgress max="100" value={now} bsStyle={bsStyle}></StyledProgress>;
};

export const TopProgressBar = ({ now, bsStyle, marginBottom }) => {
    return (
        <StyledTopProgressBar
            max="100"
            value={now}
            bsStyle={bsStyle}
            marginBottom={marginBottom}
        ></StyledTopProgressBar>
    );
};
