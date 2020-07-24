import { Link } from "react-router-dom";
import styled from "styled-components";
import { getBorder, getFontSize, getFontWeight } from "../app/theme";
import { Badge } from "./Badge";
import { CheckboxLabel, StyledCheckbox } from "./Checkbox";
import { Table } from "./Table";

export const Box = styled.div`
    border: ${getBorder};
    border-radius: ${props => props.theme.borderRadius.sm};
    box-sizing: border-box;
    cursor: ${props => (props.onClick ? "pointer" : "auto")};
    margin-bottom: 15px;
    padding: 10px 15px;
    position: relative;

    &:hover {
        ${props => (props.onClick ? `background-color: ${props.theme.color.greyHover};` : "")}
    }
`;

export const BoxGroup = styled(Box)`
    border-radius: ${props => props.theme.borderRadius.sm};
    padding: 0;
    position: relative;

    & > ${Table} {
        border: none;
        margin: 0;

        &:first-child {
            border-top: none;
        }

        tbody {
            border-top: none;
        }

        td,
        th {
            min-width: 0;
            padding: 8px 15px;
        }
    }
`;

export const BoxGroupSection = styled.div`
    background-color: transparent;
    border-radius: 0;
    color: inherit;
    cursor: ${props => (props.onClick && !props.active ? "pointer" : "auto")};
    padding: 10px 15px;
    position: relative;

    &[disabled] {
        background-color: ${props => props.theme.color.greyHover};
        cursor: not-allowed;
        color: ${props => props.theme.color.grey};
        user-select: none;
    }

    &:hover {
        ${props => (props.onClick && !props.active ? `background-color: ${props.theme.color.greyHover};` : "")}
    }

    &:not(:last-child) {
        border-bottom: ${getBorder};
    }
`;

export const SelectBoxGroupSection = styled(BoxGroupSection)`
    background-color: ${props => (props.active ? props.theme.color.blue : "transparent")};
    color: ${props => (props.active ? props.theme.color.white : "inherit")};
    cursor: pointer;

    ${StyledCheckbox} {
        background-color: ${props => (props.active ? props.theme.color.white : "transparent")};
        color: ${props => props.theme.color[props.active ? "blueDark" : "greyLight"]};
        margin-right: 10px;
    }

    ${CheckboxLabel} {
        margin: 0;
    }
`;

export const BoxGroupHeader = styled(BoxGroupSection)`
    align-items: stretch;
    background-color: ${props => props.theme.color.greyLightest};
    display: flex;
    flex-direction: column;
    font-size: ${getFontSize("md")};
    padding: 15px 15px 12px;

    h2 {
        align-items: center;
        display: flex;
        font-size: ${props => props.theme.fontSize.lg};
        font-weight: ${getFontWeight("thick")};
        margin: 0;

        a {
            text-decoration: none;
        }

        ${Badge} {
            margin-left: 5px;
        }
    }

    p {
        color: ${props => props.theme.color.greyDarkest};
        margin: 5px 0 0;
    }
`;

export const BoxTitle = styled.h1`
    font-size: ${props => props.theme.fontSize.md};
    font-weight: ${props => props.theme.fontWeight.thick};
    margin: 5px 0 15px 0;
`;

export const SpacedBox = styled(Box)`
    box-shadow: ${props => props.theme.boxShadow.md};
    margin-bottom: 10px;
`;

export const LinkBox = styled(Link)`
    border: ${getBorder};
    border-radius: ${props => props.theme.borderRadius.sm};
    box-shadow: ${props => props.theme.boxShadow.sm};
    box-sizing: border-box;
    color: ${props => props.theme.color.black};
    cursor: pointer;
    display: block;
    margin-bottom: 12px;
    padding: 10px 15px;
    position: relative;

    &:hover {
        background-color: ${props => props.theme.color.greyHover};
    }
`;
