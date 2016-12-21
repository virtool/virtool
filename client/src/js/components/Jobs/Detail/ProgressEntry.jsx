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

"use strict";

import React from "react";
import Moment from "moment";
import { capitalize } from "lodash";

var Progress = require("rc-progress").Circle;

var ProgressEntry = React.createClass({

    render: function () {
        var progress = this.props.state === "complete" ? 100: 100 * this.props.progress;

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
                            <Progress
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

});

module.exports = ProgressEntry;