import React from "react";
import { SequenceTable } from "../Table/Table";

export const GenomeSequenceTable = ({ definition, host, segment, sequence }) => (
    <SequenceTable definition={definition} host={host} sequence={sequence}>
        <tr>
            <th>Segment</th>
            <td>{segment || <em>Not configured</em>}</td>
        </tr>
    </SequenceTable>
);
