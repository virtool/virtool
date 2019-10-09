import React from "react";
import styled, { keyframes } from "styled-components";

const rotate = keyframes`
    0% {
        transform: rotate(0deg);
    }
    50% {
        transform: rotate(180deg);
    }
    100% {
        transform: rotate(360deg);
    }
`;

const StyledLoader = styled.div`
    animation: ${rotate} 0.75s 0s infinite linear;
    border: 2px solid ${props => props.color};
    border-bottom-color: transparent !important;
    border-radius: 100%;
    background: transparent;
    animation-fill-mode: both;
    display: inline-block;
    height: ${props => props.size};
    width: ${props => props.size};
`;

export const Loader = ({ className, color = "#3c8786", size = "22px", style }) => (
    <StyledLoader className={className} color={color} size={size} style={style}>
        <div />
    </StyledLoader>
);
