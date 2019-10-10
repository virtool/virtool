import React from "react";
import { map } from "lodash-es";
import styled from "styled-components";
import { Panel } from "../../base/Panel";
import { Table } from "../../base/Table";

const CacheParameterKey = styled.th`
    font-family: "Roboto Mono", monospace;
    padding-left: 15px !important;
`;

const CacheParameters = ({ parameters }) => {
    const rowComponents = map(parameters, (value, key) => (
        <tr key={key}>
            <CacheParameterKey>{key}</CacheParameterKey>
            <td>{value}</td>
        </tr>
    ));
    return (
        <Panel>
            <Panel.Heading>Trim Parameters</Panel.Heading>
            <Table>
                <tbody>{rowComponents}</tbody>
            </Table>
        </Panel>
    );
};

export default CacheParameters;
