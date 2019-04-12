import { NavLink } from "react-router-dom";
import styled from "styled-components";

export const TabLink = styled(NavLink)`
    margin-bottom: -1px;
    padding: 10px 12px;
    text-align: center;
    text-decoration: none !important;

    &.active {
        border-bottom: 1px solid #3c8786;
        box-shadow: inset 0 -1px 0 0 #3c8786;
        z-index: 1030;
    }

    &:not(.active):hover {
        border-bottom: 1px solid #898988;
        box-shadow: inset 0 -1px 0 0 #898988;
        z-index: 1030;
    }
`;
