import styled from "styled-components";
import PropTypes from "prop-types";
import { getLabelColor } from "./Label";

export const Badge = styled.span`
    background-color: ${getLabelColor};
    border-radius: ${props => props.theme.borderRadius.lg};
    color: ${props => props.theme.color.white};
    display: inline-block;
    min-width: 10px;
    padding: 3px 7px;
    font-size: ${props => props.theme.fontSize.sm};
    font-weight: bold;
    line-height: 1;
    text-align: center;
    vertical-align: middle;
    white-space: nowrap;
`;

Badge.propTypes = {
    color: PropTypes.oneOf(["blue", "green", "red", "orange", "purple"])
};
