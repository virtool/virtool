/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { mapValues, values } from "lodash";
import { Table } from "react-bootstrap";

const TaskArgs = (props) => {

    switch (props.taskType) {

        case "pathoscope_bowtie":
            return (
                <Table bordered>
                    <tbody>
                        <tr>
                            <th>Sample Name</th>
                            <td>
                                <Link to={`/samples/${props.taskArgs.sample_id}`}>
                                    {props.taskArgs.sample_name}
                                </Link>
                            </td>
                        </tr>
                        <tr>
                            <th>Sample ID</th>
                            <td>
                                <Link to={`/samples/${props.taskArgs.sample_id}`}>
                                    {props.taskArgs.sample_id}
                                </Link>
                            </td>
                        </tr>
                        <tr>
                            <th>Analysis ID</th>
                            <td>
                                <Link to={`/samples/${props.taskArgs.sample_id}/analyses`}>
                                    {props.taskArgs.analysis_id}
                                </Link>
                            </td>
                        </tr>
                    </tbody>
                </Table>
            );
    }

    const rowComponents = values(mapValues(props.taskArgs, (value, key) =>
        <tr key={key}>
            <th><code>{key}</code></th>
            <td>{JSON.stringify(value)}</td>
        </tr>
    ));

    return (
        <Table bordered>
            <tbody>
                {rowComponents}
            </tbody>
        </Table>
    );

};

TaskArgs.propTypes = {
    taskType: PropTypes.string,
    taskArgs: PropTypes.object,
    args: PropTypes.object
};

export default TaskArgs;
