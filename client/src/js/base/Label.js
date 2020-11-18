import styled from "styled-components";
import { getColor } from "../app/theme";

export const getLabelColor = props => getColor(props) || props.theme.color.greyDark;

export const getContrastColor = props => {
    const red = parseInt(props.color.substr(1, 2), 16);
    const green = parseInt(props.color.substr(3, 2), 16);
    const blue = parseInt(props.color.substr(5, 2), 16);
    const yiq = (red * 299 + green * 587 + blue * 114) / 1000;
    return yiq >= 128 ? "black" : "white";
};

export const Label = styled.span`
    background-color: ${getLabelColor};
    border-radius: ${props => props.theme.borderRadius.sm};
    color: ${getContrastColor};
    display: inline;
    font-size: ${props => props.theme.fontSize.sm};
    font-weight: bold;
    padding: 3px 5px;
    text-align: center;
    white-space: nowrap;
    vertical-align: baseline;

    ${props => (props.spaced ? "margin-right: 5px;" : "")}

    &:last-of-type {
        margin: 0;
    }
`;
