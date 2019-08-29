import styled from "styled-components";
import { Table } from "./Table";

export const Box = styled.div`
    border: 1px ${props => props.theme.color.greyLight} solid;
    border-radius: 0;
    box-sizing: border-box;
    margin-bottom: 10px;
    padding: 10px 15px;
    cursor: ${props => (props.onClick ? "pointer" : "auto")};
`;

export const BoxGroup = styled(Box)`
    padding: 0;

    ${Table} {
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
    padding: 10px 15px;

    &:not(:last-child) {
        border-bottom: 1px #dddddd solid;
    }
`;

export const BoxGroupHeader = styled(BoxGroupSection)`
    align-items: stretch;
    display: flex;
    flex-direction: column;
    padding: 10px 15px;

    h2 {
        align-items: center;
        display: flex;
        font-size: ${props => props.theme.fontSize.sm};
        justify-content: space-between;
        margin: 0;
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
