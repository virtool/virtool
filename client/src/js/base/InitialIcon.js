import { reduce } from "lodash-es";
import React, { useMemo } from "react";
import styled from "styled-components";
import { getColor, getFontSize, getFontWeight, theme } from "../app/theme";

const iconSize = {
    xs: "20px",
    sm: "24px",
    md: "28px",
    lg: "32px",
    xl: "48px",
    xxl: "64px"
};
const getIconSize = size => iconSize[size];

export const StyledInitialIcon = styled.span`
    border-radius: 50%;
    display: flex;
    flex: 0 0 auto;
    justify-content: center;
    align-items: center;
    height: ${props => getIconSize(props.size)};
    width: ${props => getIconSize(props.size)};
    font-size: ${props => getFontSize(props.size)};
    font-weight: ${getFontWeight("thick")};
    color: ${getColor({ color: "white", theme })};
    background: ${props => `hsl(${props.hash}, 83%, 21%);`};
`;

const colorHash = (hash, newChar) => (hash << 5) - newChar.charCodeAt(0);

export const InitialIcon = ({ handle, size }) => {
    const hash = useMemo(() => reduce(handle.split(""), colorHash, 0) % 360, [handle]);
    return (
        <StyledInitialIcon hash={hash} size={size} className="InitialIcon">
            {handle.slice(0, 2).toUpperCase()}
        </StyledInitialIcon>
    );
};
