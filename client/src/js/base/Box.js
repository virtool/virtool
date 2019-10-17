import { Link } from "react-router-dom";
import styled from "styled-components";
import { Badge } from "./Badge";
import { Table } from "./Table";

export const Box = styled.div`
    border: 1px ${props => props.theme.color.greyLight} solid;
    box-sizing: border-box;
    margin-bottom: 15px;
    padding: 10px 15px;
    cursor: ${props => (props.onClick ? "pointer" : "auto")};

    &:hover {
        ${props => (props.onClick ? "background-color: #f7fafc;" : "")}
    }
`;

export const BoxGroup = styled(Box)`
    padding: 0;

    & > ${Table} {
        border: none;
        border-top: 1px solid #dddddd;
        margin: 0;

        td,
        th {
            min-width: 0;
            padding: 8px 15px;
        }
    }
`;

export const BoxGroupSection = styled.div`
    cursor: ${props => (props.onClick ? "pointer" : "auto")};
    padding: 10px 15px;

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
        border-bottom: 1px #dddddd solid;
    }
`;

export const BoxGroupHeader = styled(BoxGroupSection)`
    align-items: stretch;
    background-color: #edf2f7;
    color: #2d3748;
    display: flex;
    flex-direction: column;
    padding: 15px 15px 12px;

    h2 {
        align-items: center;
        display: flex;
        font-size: 15px;
        margin: 0;

        ${Badge} {
            margin-left: 5px;
        }
    }

    p {
        color: ${props => props.theme.color.greyDark};
        margin: 5px 0 0;
        font-size: ${props => props.theme.fontSize.sm};
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
    border: 1px ${props => props.theme.color.greyLight} solid;
    box-shadow: 1px 1px 2px 0 #d5d5d5;
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
