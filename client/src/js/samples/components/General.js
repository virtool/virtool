import React from "react";
import Moment from "moment";
import Numeral from "numeral";
import { connect } from "react-redux";
import { capitalize } from "lodash";
import { Panel } from "react-bootstrap";

import { Icon, InputCell } from "virtool/js/components/Base";

const SampleDetailGeneral = (props) => {

    const cells = ["name", "host", "isolate"].map((field) => {

        let inputCell;

        if (props.canModify) {
            inputCell = (
                <InputCell
                    _id={props._id}
                    field={field}
                    value={props[field]}
                    className="col-sm-8"
                />
            );
        } else {
            inputCell = <td className="col-sm-8">{props[field]}</td>;
        }

        return (
            <tr key={field}>
                <th className="col-md-4">{capitalize(field)}</th>
                {inputCell}
            </tr>
        );

    });

    let idCell;

    if (props.showIds) {
        idCell = (
            <tr>
                <th>Database ID</th>
                <td>{props.sampleId}</td>
            </tr>
        );
    }

    return (
        <Panel className="tab-panel">
            <h5>
                <span>
                    <Icon name="tag" /> <strong>General</strong>
                </span>
            </h5>
            <table className="table table-bordered">
              <tbody>
                {cells}
                {idCell}
                <tr>
                  <th>Created At</th>
                  <td>{Moment(props.added).calendar()}</td>
                </tr>
                <tr>
                  <th>Created By</th>
                  <td>{props.userId}</td>
                </tr>
              </tbody>
            </table>

            <h5><Icon name="table" /> <strong>Library Properties</strong></h5>
            <table className="table table-condensed table-bordered">
              <tbody>
                <tr>
                  <th className="col-sm-4">Read Count</th>
                  <td className="col-sm-8">{props.count}</td>
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
            </table>

            <h5><Icon name="file" /> <strong>Files</strong></h5>
            <table className="table table-condensed table-bordered">
              <tbody>
                <tr>
                  <th className="col-sm-4">Original Files</th>
                  <td className="col-sm-8">{props.files.join(", ")}</td>
                </tr>
                <tr>
                  <th>Encoding</th>
                  <td>{props.encoding}</td>
                </tr>
              </tbody>
            </table>
        </Panel>
    );
};

SampleDetailGeneral.propTypes = {
    showIds: React.PropTypes.bool,
    canModify: React.PropTypes.bool,
    sampleId: React.PropTypes.string,
    name: React.PropTypes.string,
    host: React.PropTypes.string,
    files: React.PropTypes.array,
    isolate: React.PropTypes.string,
    lengthRange: React.PropTypes.string,
    encoding: React.PropTypes.string,
    gc: React.PropTypes.string,
    count: React.PropTypes.string,
    paired: React.PropTypes.bool,
    userId: React.PropTypes.string,
    added: React.PropTypes.string,
    quality: React.PropTypes.object
};

const mapStateToProps = (state) => {
    const detail = state.samples.detail;

    const isOwner = state.account.user_id === detail.user_id;

    const canModify = (
        detail.all_write ||
        (detail.group_write && detail.account.groups.indexOf(detail.group) > -1) ||
        isOwner
    );

    return {
        canModify: canModify,
        sampleId: detail.sample_id,
        name: detail.name,
        host: detail.host,
        added: detail.added,
        isolate: detail.isolate,
        showIds: state.account.settings.show_ids,
        files: detail.files,
        paired: detail.paired,
        gc: Numeral(detail.quality.gc / 100).format("0.0 %"),
        count: Numeral(detail.quality.count).format("0.0 a"),
        encoding: detail.quality.encoding,
        lengthRange: detail.quality.length.join(" - "),
        userId: detail.user_id
    };
};

const Container = connect(mapStateToProps)(SampleDetailGeneral);

export default Container;
