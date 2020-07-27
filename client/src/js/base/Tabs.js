import { NavLink } from "react-router-dom";
import styled from "styled-components";
import { getBorder, getFontSize, getFontWeight } from "../app/theme";

export const Tabs = styled.nav`
    border-bottom: ${getBorder};
    display: flex;
    margin-bottom: 15px;
    width: 100%;
`;

export const TabLink = styled(NavLink)`
    font-size: ${getFontSize("lg")};
    font-weight: ${getFontWeight("thick")};
    margin-bottom: -1px;
    padding: 10px 12px;
    text-align: center;
    z-index: 999;

    &.active {
        border-bottom: 1px solid ${props => props.theme.color.primary};
        box-shadow: inset 0 -1px 0 0 ${props => props.theme.color.primary};
    }

    &:not(.active):hover {
        border-bottom: 1px solid ${props => props.theme.color.grey};
        box-shadow: inset 0 -1px 0 0 ${props => props.theme.color.grey};
    }
`;
