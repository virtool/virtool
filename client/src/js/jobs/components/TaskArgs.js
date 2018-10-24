import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { mapValues, values } from "lodash-es";
import { Table } from "react-bootstrap";

const TaskArgs = props => {
  switch (props.taskType) {
    case "nuvs":
    case "pathoscope_bowtie":
      return (
        <Table bordered>
          <tbody>
            <tr>
              <th className="col-xs-4">Sample</th>
              <td className="col-xs-8">
                <Link to={`/samples/${props.taskArgs.sample_id}`}>
                  {props.taskArgs.sample_name}
                </Link>
              </td>
            </tr>
            <tr>
              <th>Analysis</th>
              <td>
                <Link to={`/samples/${props.taskArgs.sample_id}/analyses`}>
                  {props.taskArgs.analysis_id}
                </Link>
              </td>
            </tr>
          </tbody>
        </Table>
      );

    case "rebuild_index":
      return (
        <Table bordered>
          <tbody>
            <tr>
              <th>Index Version</th>
              <td>
                <Link to={`/otus/indexes/${props.taskArgs.index_version}`}>
                  <span>{props.taskArgs.index_version}</span>
                </Link>
              </td>
            </tr>
          </tbody>
        </Table>
      );
  }

  const rowComponents = values(
    mapValues(props.taskArgs, (value, key) => {
      if (key !== "manifest") {
        return (
          <tr key={key}>
            <th className="col-xs-4">
              <code>{key}</code>
            </th>
            <td className="col-xs-8">{JSON.stringify(value)}</td>
          </tr>
        );
      }

      return (
        <tr key={key}>
          <th>
            <code>{key}</code>
          </th>
          <td className="sequence-cell">
            <textarea rows="5" value={JSON.stringify(value)} readOnly />
          </td>
        </tr>
      );
    })
  );

  return (
    <Table bordered>
      <tbody>{rowComponents}</tbody>
    </Table>
  );
};

TaskArgs.propTypes = {
  taskType: PropTypes.string,
  taskArgs: PropTypes.object
};

export default TaskArgs;
