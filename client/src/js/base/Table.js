import styled from "styled-components";
import { getBorder, getFontWeight } from "../app/theme";

export const Table = styled.table`
    border-collapse: collapse;
    border-spacing: 0;
    border: ${getBorder};
    border-radius: ${props => props.theme.borderRadius.sm};
    display: table;
    margin-bottom: 15px;
    width: 100%;

    caption {
        caption-side: top;
        padding: 0 0 10px;
    }

    tbody {
        display: table-row-group;
        vertical-align: middle;

        tr:last-child {
            border: none;
        }
    }

    th {
        font-weight: ${getFontWeight("thick")};
        text-align: left;
    }

    td,
    th {
        border-right: ${getBorder};
        display: table-cell;
        min-width: 250px;
        padding: 8px;

        &:last-child {
            border: none;
        }
    }

    tr {
        border-bottom: ${getBorder};
        display: table-row;
    }

    tbody th {
        vertical-align: top;
    }
`;
