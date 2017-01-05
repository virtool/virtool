/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ProgressEntry
 */

import React from "react";
import Moment from "moment";
import { Circle } from "rc-progress";
import { capitalize } from "lodash";

export default class ProgressEntry extends React.Component {

    static propTypes = {
        state: React.PropTypes.string,
        stage: React.PropTypes.string,
        progress: React.PropTypes.number,
        date: React.PropTypes.string
    };

    render () {

        const progress = this.props.state === "complete" ? 100: 100 * this.props.progress;

        return (
            <tr>
                <td>
                    <span>
                        {Moment(this.props.date).format("MMM Do YYYY - hh:mm:ss")}
                    </span>
                </td>
                <td>
                    <span>
                        {capitalize(this.props.state)}
                    </span>
                </td>
                <td>
                    <span>
                        {this.props.stage}
                        <div className="pull-right" style={{height: "16px", width: "16px"}}>
                            <Circle
                                percent={progress}
                                strokeWidth={12}
                                strokeColor="#337ab7"
                            />
                        </div>
                    </span>
                </td>
            </tr>
        );
    }

}
