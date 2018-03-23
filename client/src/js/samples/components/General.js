import React from "react";
import Moment from "moment";
import Numeral from "numeral";
import { map } from "lodash-es";
import { Panel, Table } from "react-bootstrap";
import { connect } from "react-redux";

import EditSample from "./Edit";
import { IDRow } from "../../base";

const cellNames = ["name", "host", "isolate"];

const SampleDetailGeneral = (props) => (
    <div>
        <table className="table table-bordered">
            <tbody>
                {map(cellNames, field =>
                    <tr key={field}>
                        <th className="col-xs-4 text-capitalize">{field}</th>
                        <td className="col-xs-8">{props[field]}</td>
                    </tr>
                )}

                <IDRow id={props.id} />

                <tr>
                    <th>Created</th>
                    <td>{Moment(props.created_at).calendar()}</td>
                </tr>
                <tr>
                    <th>Created By</th>
                    <td>{props.userId}</td>
                </tr>
            </tbody>
        </table>

        <Panel>
            <Panel.Heading>Library</Panel.Heading>
            <Panel.Body>
                <Table bordered fill>
                    <tbody>
                        <tr>
                            <th className="col-xs-4">Read Count</th>
                            <td className="col-xs-8">{props.count}</td>
                        </tr>
                        <tr>
                            <th>Length Range</th>
                            <td>{props.lengthRange}</td>
                        </tr>
                        <tr>
                            <th>GC Content</th>
                            <td>{props.gc}</td>
                        </tr>
                        <tr>
                            <th>Paired</th>
                            <td>{props.paired ? "Yes" : "No"}</td>
                        </tr>
                    </tbody>
                </Table>
            </Panel.Body>
        </Panel>

        <Panel>
            <Panel.Heading>Files</Panel.Heading>
            <Panel.Body>
                <Table bordered fill>
                    <tbody>
                        <tr>
                            <th className="col-xs-4">Original Files</th>
                            <td className="col-xs-8">{props.files.join(", ")}</td>
                        </tr>
                        <tr>
                            <th>Encoding</th>
                            <td>{props.encoding}</td>
                        </tr>
                    </tbody>
                </Table>
            </Panel.Body>
        </Panel>

        <EditSample />
    </div>
);

const mapStateToProps = (state) => {
    const detail = state.samples.detail;

    return {
        ...detail,
        gc: Numeral(detail.quality.gc / 100).format("0.0 %"),
        count: Numeral(detail.quality.count).format("0.0 a"),
        encoding: detail.quality.encoding,
        lengthRange: detail.quality.length.join(" - "),
        userId: detail.user.id
    };
};

export default connect(mapStateToProps)(SampleDetailGeneral);
