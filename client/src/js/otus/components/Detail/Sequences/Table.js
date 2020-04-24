import React from "react";
import styled from "styled-components";
import { Badge, Table } from "../../../../base";

const SequenceCell = styled.td`
    padding: 0 !important;
    font-family: "Roboto Mono", monospace;

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

export const SequenceTable = ({ definition, host, segment, sequence, target }) => {
    let segmentTargetRow;

    if (target) {
        segmentTargetRow = (
            <tr>
                <th>Target</th>
                <td>{target}</td>
            </tr>
        );
    } else {
        segmentTargetRow = (
            <tr>
                <th>Segment</th>
                <td>{segment || <em>Not configured</em>}</td>
            </tr>
        );
    }

    return (
        <StyledSequenceTable>
            <tbody>
                <tr>
                    <th>Definition</th>
                    <td>{definition}</td>
                </tr>
                {segmentTargetRow}
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
};
