import React from "react";
import Moment from "moment";
import Numeral from "numeral";
import { capitalize } from "lodash";
import { connect } from "react-redux";
import { Panel, Table } from "react-bootstrap";

import EditSample from "./Edit";

const SampleDetailGeneral = (props) => {

    const cells = ["name", "host", "isolate"].map(field =>
        <tr key={field}>
            <th className="col-xs-4">{capitalize(field)}</th>
            <td className="col-xs-8">{props[field]}</td>
        </tr>
    );

    let idCell;

    if (props.showIds) {
        idCell = (
            <tr>
                <th>Unique ID</th>
                <td>{props.sampleId}</td>
            </tr>
        );
    }

    return (
        <div>
            <table className="table table-bordered">
              <tbody>
                {cells}
                {idCell}
                <tr>
                  <th>Created</th>
                  <td>{Moment(props.createdAt).calendar()}</td>
                </tr>
                <tr>
                  <th>Created By</th>
                  <td>{props.userId}</td>
                </tr>
              </tbody>
            </table>

            <Panel header="Library">
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
                            <td>{props.paired ? "Yes": "No"}</td>
                        </tr>
                    </tbody>
                </Table>
            </Panel>

            <Panel header="Files">
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
            </Panel>

            <EditSample />
        </div>
    );
};

const mapStateToProps = (state) => {
    const detail = state.samples.detail;

    return {
        ...detail,
        showIds: state.account.settings.show_ids,
        gc: Numeral(detail.quality.gc / 100).format("0.0 %"),
        count: Numeral(detail.quality.count).format("0.0 a"),
        encoding: detail.quality.encoding,
        lengthRange: detail.quality.length.join(" - "),
        userId: detail.user.id
    };
};

const Container = connect(mapStateToProps)(SampleDetailGeneral);

export default Container;
