import styled from "styled-components";

export const Table = styled.table`
    border-collapse: collapse;
    border-spacing: 0;
    border: 1px solid #dddddd;
    border-radius: ${props => props.theme.borderRadius.sm};
    display: table;
    margin-bottom: 15px;
    width: 100%;

    tbody {
        display: table-row-group;
        vertical-align: middle;

        tr:last-child {
            border: none;
        }
    }

    th {
        font-weight: bold;
        text-align: left;
    }

    td,
    th {
        border-right: 1px solid #dddddd;
        display: table-cell;
        min-width: 250px;
        padding: 8px;

        &:last-child {
            border: none;
        }
    }

    tr {
        border-bottom: 1px solid #dddddd;
        display: table-row;
    }

    tbody th {
        vertical-align: top;
    }
`;
