import { NavLink } from "react-router-dom";
import styled from "styled-components";

export const NavBarItem = styled(NavLink)`
    align-items: center;
    color: white;
    cursor: pointer;
    display: flex;
    font-size: ${props => props.theme.fontSize.lg};
    font-weight: ${props => props.theme.fontWeight.thick};
    height: 100%;
    justify-content: center;
    padding: 0 15px;

    &:hover {
        color: ${props => props.theme.color.primaryDarkest};
    }

    &.active {
        background-color: ${props => props.theme.color.primaryDark};
        color: ${props => props.theme.color.white};
    }
`;
