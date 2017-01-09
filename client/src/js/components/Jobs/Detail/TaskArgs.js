/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports TaskArgs
 */

import React from "react";
import { transform } from "lodash";
import TaskArgNode from "./TaskArgNode";

/**
 * A component that renders a job"s task args as a human-readable nested list.
 */
export default class TaskArgs extends React.PureComponent {

    static propTypes = {
        taskArgs: React.PropTypes.object.isRequired
    };

    render () {
        // Render the first level nodes of the task args object.
        const nodeComponents = transform(this.props.taskArgs, (result, value, key) => {
            result.push(<TaskArgNode key={`${value}-${key}`} nodeKey={key} nodeData={value}/>);
        }, []);

        return (
            <ul style={{ listStyleType: "none", paddingLeft: 0 }}>
                {nodeComponents}
            </ul>
        );
    }
}
