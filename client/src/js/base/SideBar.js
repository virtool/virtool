import styled from "styled-components";
import { Box } from "./Box";
import { borderRadius, boxShadow, fontWeight, getFontSize } from "../app/theme";

export const SideBarSection = styled(Box)`
    background-color: #f8fafc;
    border: none;
    border-radius: ${borderRadius.md};
    box-shadow: ${boxShadow.sm};
    margin-bottom: 15px;
    position: static;
`;

export const SidebarHeaderButton = styled.button`
    align-items: center;
    background-color: ${props => props.theme.color.greyLightest};
    border: none;
    border-radius: 50%;
    color: ${props => props.theme.color.greyDark};
    cursor: pointer;
    display: flex;
    font-size: ${getFontSize("md")};
    justify-content: center;
    height: 32px;
    width: 32px;

    &:hover,
    &:focus {
        background-color: ${props => props.theme.color.greyDark};
        box-shadow: ${boxShadow.sm};
        color: ${props => props.theme.color.white};
        outline: none;
    }

    &:focus {
        background-color: ${props => props.theme.color.grey};
    }
`;

export const SidebarHeader = styled.h3`
    align-items: center;
    display: flex;
    font-size: ${getFontSize("lg")};
    font-weight: ${fontWeight.thick};
    margin: 5px 0 10px;

    ${SidebarHeaderButton}, a {
        margin-left: auto;
    }

    a {
        font-size: ${getFontSize("md")};
    }
`;
