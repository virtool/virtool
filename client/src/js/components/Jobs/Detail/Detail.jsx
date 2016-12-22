/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports JobDetail
 */

"use strict";

import React from "react";
import {last} from "lodash";
import {Modal} from "react-bootstrap";
import ProgressTable from "./ProgressTable.jsx";
import JobLog from "./Log.jsx";
import General from "./General.jsx";
import Error from "./Error.jsx";
import Footer from "./Footer.jsx";

/**
 * A component that contains modal content that describes a Virtool job. It contains general information, a status log,
 * a description of any errors, and buttons for removing, archiving, or cancelling the job.
 */
var JobDetail = React.createClass({

    render: function () {

        var data = this.props.detail;

        // The error will be included in the last status update of a failed job. If undefined, no error message will be
        // displayed.
        var error = last(data.status).error;

        return (
            <div>
                <Modal.Body>
                    <General {...data} />
                    {error ? <Error error={error} />: null}
                    <ProgressTable status={data.status} log={data.log} />
                    {data.log ? <JobLog log={data.log} />: null}
                </Modal.Body>

                <Footer
                    {...data}
                    collection={this.props.collection}
                    onHide={this.props.onHide}
                />
            </div>
        )
    }

});

module.exports = JobDetail;