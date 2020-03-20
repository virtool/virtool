import { Link } from "react-router-dom";
import styled from "styled-components";
import { getBorder } from "../app/theme";
import { Badge } from "./Badge";
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
        ${props => (props.onClick ? "background-color: #f7fafc;" : "")}
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
    border-radius: 0;
    cursor: ${props => (props.onClick ? "pointer" : "auto")};
    padding: 10px 15px;
    position: relative;

    ${props => (props.active ? "background-color: #07689d;" : "")}
    ${props => (props.active ? "color: #ffffff;" : "")}

    &[disabled] {
        background-color: #edf2f7;
        cursor: not-allowed;
        color: #718096;
    }

    &:hover {
        ${props => (props.onClick && !props.active ? "background-color: #f7fafc;" : "")}
    }

    &:not(:last-child) {
        border-bottom: ${getBorder};
    }
`;

export const SuccessBoxGroupSection = styled(BoxGroupSection)`
    background-color: #dff0d8;
    color: #3c763d;
`;

export const DangerBoxGroupSection = styled(BoxGroupSection)`
    background-color: #f0c1bd;
    color: #af3227;
    position: relative;
`;

export const BoxGroupHeader = styled(BoxGroupSection)`
    align-items: stretch;
    background-color: ${props => props.theme.color.greyLightest};
    display: flex;
    flex-direction: column;
    font-size: ${props => props.theme.fontSize.md};
    padding: 15px 15px 12px;

    h2 {
        align-items: center;
        display: flex;
        font-size: 15px;
        font-weight: bold;
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

BoxGroup.Header = BoxGroupHeader;
BoxGroup.Section = BoxGroupSection;

export const BoxTitle = styled.h1`
    font-size: 14px;
    font-weight: bold;
    margin: 5px 0 15px 0;
`;

export const SpacedBox = styled(Box)`
    box-shadow: 1px 1px 2px 0 #d5d5d5;
    margin-bottom: 10px;
`;

export const LinkBox = styled(Link)`
    border: ${getBorder};
    border-radius: ${props => props.theme.borderRadius.sm};
    box-shadow: ${props => props.theme.boxShadow.sm};
    box-sizing: border-box;
    color: #333333 !important;
    cursor: pointer;
    display: block;
    margin-bottom: 12px;
    padding: 10px 15px;
    text-decoration: none !important;

    &:hover {
        background-color: #f7fafc;
    }
`;

export const LinkBoxTop = styled.div`
    align-items: center;
    display: flex;
    justify-content: space-between;
`;
