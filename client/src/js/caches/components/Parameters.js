import React from "react";
import { map } from "lodash-es";
import styled from "styled-components";
import { BoxGroup, BoxGroupHeader, Table } from "../../base";

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
        <BoxGroup>
            <BoxGroupHeader>Trim Parameters</BoxGroupHeader>
            <Table>
                <tbody>{rowComponents}</tbody>
            </Table>
        </BoxGroup>
    );
};

export default CacheParameters;
