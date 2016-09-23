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

'use strict';

var React = require('react');
var Modal = require('react-bootstrap/lib/Modal');

var ProgressTable = require('./ProgressTable.jsx');
var JobLog = require('./Log.jsx');
var General = require('./General.jsx');
var Error = require('./Error.jsx');
var Footer = require('./Footer.jsx');

/**
 * A component that contains modal content that describes a Virtool job. It contains general information, a status log,
 * a description of any errors, and buttons for removing, archiving, or cancelling the job.
 */
var JobDetail = React.createClass({

    render: function () {

        var data = this.props.detail;

        // The error will be included in the last status update of a failed job. If undefined, no error message will be
        // displayed.
        var error = _.last(data.status).error;

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