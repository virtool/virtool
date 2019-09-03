import numbro from "numbro";
import React from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { BoxGroup, BoxGroupHeader, Table } from "../../base";
import EditSample from "./Edit";

export const SampleDetailGeneral = ({
    count,
    encoding,
    gc,
    host,
    isolate,
    lengthRange,
    locale,
    paired,
    subtractionId,
    srna
}) => (
    <div>
        <Table>
            <tbody>
                <tr>
                    <th>Host</th>
                    <td>{host}</td>
                </tr>
                <tr>
                    <th>Isolate</th>
                    <td>{isolate}</td>
                </tr>
                <tr>
                    <th>Locale</th>
                    <td>{locale}</td>
                </tr>
            </tbody>
        </Table>

        <BoxGroup>
            <BoxGroupHeader>
                <h2>Library</h2>
                <p>Information about the sequencing reads in this sample.</p>
            </BoxGroupHeader>
            <Table>
                <tbody>
                    <tr>
                        <th>Encoding</th>
                        <td>{encoding}</td>
                    </tr>
                    <tr>
                        <th>Read Count</th>
                        <td>{count}</td>
                    </tr>
                    <tr>
                        <th>Read Size</th>
                        <td>{srna ? "sRNA" : "Normal"}</td>
                    </tr>
                    <tr>
                        <th>Length Range</th>
                        <td>{lengthRange}</td>
                    </tr>
                    <tr>
                        <th>GC Content</th>
                        <td>{gc}</td>
                    </tr>
                    <tr>
                        <th>Paired</th>
                        <td>{paired ? "Yes" : "No"}</td>
                    </tr>
                </tbody>
            </Table>
        </BoxGroup>

        <BoxGroup>
            <BoxGroupHeader>
                <h2>Subtraction</h2>
                <p>This host genome is used for excluding reads from analysis.</p>
            </BoxGroupHeader>
            <Table>
                <tbody>
                    <tr>
                        <th>Host</th>
                        <td>
                            <Link to={`/subtraction/${subtractionId}`}>{subtractionId}</Link>
                        </td>
                    </tr>
                </tbody>
            </Table>
        </BoxGroup>

        <EditSample />
    </div>
);

export const mapStateToProps = state => {
    const { host, isolate, locale, paired, quality, srna, subtraction } = state.samples.detail;
    const { count, encoding, gc, length } = quality;

    return {
        encoding,
        host,
        isolate,
        locale,
        paired,
        srna,
        gc: numbro(gc / 100).format("0.0 %"),
        count: numbro(count).format("0.0 a"),
        lengthRange: length.join(" - "),
        subtractionId: subtraction.id
    };
};

export default connect(mapStateToProps)(SampleDetailGeneral);
