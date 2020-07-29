import { replace } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import styled from "styled-components";
import { getBorder } from "../../../app/theme";
import { Table } from "../../../base";

export const ExportPreviewCode = styled.div`
    background-color: ${props => props.theme.color.greyLightest};
    border: ${getBorder};
    border-radius: ${props => props.theme.borderRadius.sm};
    box-shadow: ${props => props.theme.boxShadow.inset};
    color: ${props => props.theme.color.greyDarkest};
    margin-bottom: 15px;
    min-height: 20px;
    padding: 20px;
`;

export default function NuVsExportPreview({ mode }) {
    let previewHeader = ">sequence_1|17SP002|RNA Polymerase";
    let previewSequence;
    let indexName;
    let indexExample;
    let barName;
    let barExample;

    if (mode === "contigs") {
        indexName = "sequence index";
        indexExample = "sequence_1";

        barName = "bar-separated ORF annotations";
        barExample = "RNA Polymerase|cg30";

        previewHeader += "|cg30";
        previewSequence = "CATTTTATCAATAACAATTAAAACAAACAAACAAAAAAACCTTACCAGCAGCAACAGCAAGATGGCCAAATAGGAACAGATAGGGAC";
    } else {
        indexName = "sequence index + orf index";
        indexExample = "orf_1_1";

        barName = "best annotation";
        barExample = "RNA Polymerase";

        previewHeader = replace(previewHeader, "sequence_1", "orf_1_1");
        previewSequence = "ELREECRSLRSRCDQLEERVSAMEDEMNEMKREGKFREKRIKRNEQSLQEIWDYVKRPNLRLIGVPESDGENGTKLENTFREKSAME";
    }

    return (
        <div>
            <label>Preview</label>
            <ExportPreviewCode>
                <p style={{ wordWrap: "break-word", marginBottom: 0 }}>
                    <code>{previewHeader}</code>
                </p>
                <p style={{ wordWrap: "break-word" }}>
                    <code>
                        {previewSequence}
                        &hellip;
                    </code>
                </p>
            </ExportPreviewCode>

            <label>Header Fields</label>
            <Table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Example</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>{indexName}</td>
                        <td>
                            <code>{indexExample}</code>
                        </td>
                    </tr>
                    <tr>
                        <td>sample name</td>
                        <td>
                            <code>17SP002</code>
                        </td>
                    </tr>
                    <tr>
                        <td>{barName}</td>
                        <td>
                            <code>{barExample}</code>
                        </td>
                    </tr>
                </tbody>
            </Table>
        </div>
    );
}

NuVsExportPreview.propTypes = {
    mode: PropTypes.string.isRequired
};
