import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { Badge, Table } from "../../../base";

const SequenceCell = styled.td`
    padding: 0 !important;
    font-family: ${props => props.theme.fontFamily.monospace};

    textarea {
        width: 100%;
        margin: 0 0 -4px 0;
        padding: 5px;
        border: none;
    }
`;

const StyledSequenceTable = styled(Table)`
    margin-top: 10px;
    table-layout: fixed;

    th {
        width: 130px;
    }
`;

export const SequenceTable = ({ children, definition, host, sequence }) => (
    <StyledSequenceTable>
        <tbody>
            <tr>
                <th>Definition</th>
                <td>{definition}</td>
            </tr>
            {children}
            <tr>
                <th>Host</th>
                <td>{host}</td>
            </tr>

            <tr>
                <th>
                    Sequence <Badge>{sequence.length}</Badge>
                </th>
                <SequenceCell>
                    <textarea rows="5" value={sequence} readOnly />
                </SequenceCell>
            </tr>
        </tbody>
    </StyledSequenceTable>
);

SequenceTable.propTypes = {
    children: PropTypes.node.isRequired,
    definition: PropTypes.string.isRequired,
    host: PropTypes.string.isRequired,
    sequence: PropTypes.string.isRequired
};
