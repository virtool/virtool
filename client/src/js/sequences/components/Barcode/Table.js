import React from "react";
import { SequenceTable } from "../Table/Table";

export const BarcodeSequenceTable = ({ definition, host, sequence, target }) => (
    <SequenceTable definition={definition} host={host} sequence={sequence}>
        <tr>
            <th>Target</th>
            <td>{target}</td>
        </tr>
    </SequenceTable>
);
