import React from "react";
import { map, min, max, mean } from "lodash-es";

import styled from "styled-components";
import { connect } from "react-redux";
import { getActiveHit } from "../../selectors";
import { BoxGroup, Table } from "../../../base";

const StyledTable = styled(Table)`
    text-align: center;

    th {
        text-align: center;
    }
`;

const Round = num => {
    return Math.round(num * 100) / 100;
};

export const IsolateItem = isolate => {
    const components = map(isolate.sequences, sequence => (
        <tr key={sequence.id}>
            <td>{sequence.accession}</td>
            <td>{sequence.hit ? sequence.hit.length : 0} </td>

            <td>{sequence.identities.length ? Round(min(sequence.identities)) : "-"}</td>
            <td>{sequence.identities.length ? Round(mean(sequence.identities)) : "-"}</td>
            <td>{sequence.identities.length ? Round(max(sequence.identities)) : "-"}</td>
        </tr>
    ));

    return (
        <BoxGroup style={{ marginTop: "10px" }}>
            <StyledTable>
                <thead>
                    <tr>
                        <th>Sequence</th>
                        <th>Hits</th>
                        <th>Min</th>
                        <th>Mean</th>
                        <th>Max</th>
                    </tr>
                </thead>
                <tbody>{components}</tbody>
            </StyledTable>
        </BoxGroup>
    );
};

const mapStateToProps = state => {
    const hit = getActiveHit(state);
    return {
        result: hit
    };
};

export default connect(mapStateToProps)(IsolateItem);
