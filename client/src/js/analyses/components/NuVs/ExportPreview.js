/**
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 */
import React from "react";
import PropTypes from "prop-types";
import { replace } from "lodash-es";
import { Well } from "react-bootstrap";
import { Table } from "../../../base";

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
            <Well className="text-muted">
                <p style={{ wordWrap: "break-word", marginBottom: 0 }}>
                    <code>{previewHeader}</code>
                </p>
                <p style={{ wordWrap: "break-word" }}>
                    <code>
                        {previewSequence}
                        &hellip;
                    </code>
                </p>
            </Well>

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
