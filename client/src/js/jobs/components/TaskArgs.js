/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import React, { PropTypes } from "react";
import { mapValues, values } from "lodash";
import { Table, Panel } from "react-bootstrap";

const TestTask = (props) => (
    <Panel>
        Test
        {JSON.stringify(props.taskArgs)}
    </Panel>
);

TestTask.propTypes = {
    args: PropTypes.object
};

const TaskArgs = (props) => {

    switch (props.taskType) {

        case "rebuild":
            return <TestTask {...props} />;



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
    args: PropTypes.object
};

export default TaskArgs;