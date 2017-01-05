import React from "react";
import Moment from "moment";
import Numeral from "numeral";
import { capitalize } from "lodash-es";
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
                    collection={dispatcher.db.samples}
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
                {
                    dispatcher.user.settings.show_ids ? (
                        <tr>
                            <th>Database ID</th>
                            <td>{props._id}</td>
                        </tr>
                    ) : null
                }
                {
                    dispatcher.user.settings.show_versions ? (
                        <tr>
                            <th>Database Version</th>
                            <td>{props._version}</td>
                        </tr>
                    ) : null
                }
                <tr>
                  <th>Added</th>
                  <td>{Moment(props.added).calendar()}</td>
                </tr>
                <tr>
                  <th>Added By</th>
                  <td>{props.username}</td>
                </tr>
              </tbody>
            </table>

            <h5><Icon name="table" /> <strong>Library Properties</strong></h5>
            <table className="table table-condensed table-bordered">
              <tbody>
                <tr>
                  <th className="col-sm-4">Read Count</th>
                  <td className="col-sm-8">{Numeral(props.quality.count).format("0.0 a")}</td>
                </tr>
                <tr>
                  <th>Length Range</th>
                  <td>{props.quality.length.join(" - ")}</td>
                </tr>
                <tr>
                  <th>GC Content</th>
                  <td>{Numeral(props.quality.gc / 100).format("0.0 %")}</td>
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
                  <td>{props.quality.encoding}</td>
                </tr>
              </tbody>
            </table>
        </Panel>
    );
};

SampleDetailGeneral.propTypes = {
    _id: React.PropTypes.string.isRequired,
    _version: React.PropTypes.number.isRequired,
    name: React.PropTypes.string,
    host: React.PropTypes.string,
    files: React.PropTypes.array,
    isolate: React.PropTypes.string,
    paired: React.PropTypes.bool.isRequired,
    username: React.PropTypes.string.isRequired,
    added: React.PropTypes.string.isRequired,
    quality: React.PropTypes.object.isRequired
};

export default SampleDetailGeneral;
