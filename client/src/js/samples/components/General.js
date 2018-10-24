import React from "react";
import numbro from "numbro";
import { map } from "lodash-es";
import { Panel, Table } from "react-bootstrap";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { IDRow } from "../../base";
import EditSample from "./Edit";

const cellNames = ["name", "host", "isolate", "locale"];

const SampleDetailGeneral = props => (
  <div>
    <table className="table table-bordered">
      <tbody>
        {map(cellNames, field => (
          <tr key={field}>
            <th className="col-xs-4 text-capitalize">{field}</th>
            <td className="col-xs-8">{props[field]}</td>
          </tr>
        ))}

        <IDRow id={props.id} />
      </tbody>
    </table>

    <Panel>
      <Panel.Heading>Library</Panel.Heading>
      <Table bordered>
        <tbody>
          <tr>
            <th className="col-xs-4">Read Count</th>
            <td className="col-xs-8">{props.count}</td>
          </tr>
          <tr>
            <th>Read Size</th>
            <td>{props.srna ? "sRNA" : "Normal"}</td>
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
    </Panel>

    <Panel>
      <Panel.Heading>Files</Panel.Heading>
      <Table bordered>
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

    <Panel>
      <Panel.Heading>Subtraction</Panel.Heading>
      <Table bordered>
        <tbody>
          <tr>
            <th className="col-xs-4">Host</th>
            <td className="col-xs-8">
              <Link to={`/subtraction/${props.subtraction.id}`}>
                {props.subtraction.id}
              </Link>
            </td>
          </tr>
        </tbody>
      </Table>
    </Panel>

    <EditSample />
  </div>
);

const mapStateToProps = state => {
  const detail = state.samples.detail;

  return {
    ...detail,
    gc: numbro(detail.quality.gc / 100).format("0.0 %"),
    count: numbro(detail.quality.count).format("0.0 a"),
    encoding: detail.quality.encoding,
    lengthRange: detail.quality.length.join(" - "),
    userId: detail.user.id
  };
};

export default connect(mapStateToProps)(SampleDetailGeneral);
