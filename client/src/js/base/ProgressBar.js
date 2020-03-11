import { get } from "lodash-es";
import React from "react";
import styled from "styled-components";

const getProgressColor = ({ color, theme }) => get(theme, ["color", color], theme.color.blue);

const StyledProgress = styled.progress`
    -webkit-appearance: none;
    height: 20px;
    margin-bottom: 10px;
    width: 100%;

    ::-webkit-progress-value {
        background-color: ${getProgressColor};
    }

    ::-webkit-progress-bar {
        background-color: #f5f5f5;
    }
`;

const StyledAffixedProgress = styled(StyledProgress)`
    height: 5px;
    left: 0;
    margin: 0;
    position: absolute;

    ${props => (props.bottom ? "bottom" : "top")}: 0;

    ::-webkit-progress-bar {
        background-color: transparent;
    }
`;

export const AffixedProgressBar = ({ now, color, bottom }) => {
    return <StyledAffixedProgress max="100" value={now} color={color} bottom={bottom} />;
};

export const ProgressBar = ({ now, color }) => {
    return <StyledProgress max="100" value={now} color={color} />;
};
