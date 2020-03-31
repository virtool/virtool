import { map, max, mean, min } from "lodash-es";
import React from "react";
import styled from "styled-components";
import { getBorder } from "../../../app/theme";
import { BoxGroupSection, Label, Table } from "../../../base";
import { formatIsolateName } from "../../../utils/utils";

const StyledAODPIsolate = styled(BoxGroupSection)`
    h4 {
        font-size: ${props => props.theme.fontSize.md};
        font-weight: bold;
        margin-bottom: 15px;
    }

    ${Table} {
        border-left: none;
        border-top: none;
        position: relative;
        table-layout: fixed;
        width: 100%;

        thead > tr,
        tbody > tr {
            td,
            th {
                width: 16.6%;

                &:nth-child(1) {
                    width: 33.3%;
                }
            }

            td:not(:first-child),
            th:not(:first-child) {
                text-align: center;
            }
        }

        tbody td {
            border-left: ${getBorder};
        }

        thead tr:not(:first-child) th {
            border-left: ${getBorder};
        }

        thead > tr:first-child {
            th {
                padding: 3px 0;
                width: auto;
            }

            th:last-child {
                background-color: ${props => props.theme.color.greyLightest};
                border-top: ${getBorder};
                color: ${props => props.theme.color.greyDarkest};
                font-size: ${props => props.theme.fontSize.sm};
            }
        }
    }
`;

export const AODPIsolate = props => {
    const { sequences } = props;

    const sequenceComponents = map(sequences, ({ accession, hits, id, identities }) => (
        <tr key={id}>
            <td>{accession}</td>
            <td>{hits ? hits.length : 0} </td>
            <td>{identities.length ? min(identities).toFixed(1) : "-"}</td>
            <td>{identities.length ? mean(identities).toFixed(1) : "-"}</td>
            <td>{identities.length ? max(identities).toFixed(1) : "-"}</td>
        </tr>
    ));

    return (
        <StyledAODPIsolate>
            <h4>
                <Label>Isolate</Label> {formatIsolateName(props)}
            </h4>
            <Table>
                <thead>
                    <tr>
                        <th colSpan={2} />
                        <th colSpan={3}>Identity (%)</th>
                    </tr>
                    <tr>
                        <th>Sequence</th>
                        <th>Hits</th>
                        <th>Min</th>
                        <th>Mean</th>
                        <th>Max</th>
                    </tr>
                </thead>
                <tbody>{sequenceComponents}</tbody>
            </Table>
        </StyledAODPIsolate>
    );
};
