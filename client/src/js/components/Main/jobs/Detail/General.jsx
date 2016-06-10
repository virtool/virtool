/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports JobDetailGeneral
 */

'use strict';

var _ = require('lodash');
var React = require('react');
var Table = require('react-bootstrap/lib/Table');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var TaskArgs = require('./TaskArgs.jsx');

/**
 * A render-only table that presents the general information about a job.
 */
var JobDetailGeneral = React.createClass({

    shouldComponentUpdate: function () {
        return false;
    },

    render: function () {

        var jobIdRow = dispatcher.user.settings.show_ids ? (
            <tr>
                <td><b>Database ID</b></td>
                <td>{this.props._id}</td>
            </tr>
        ): null;

        var jobVersionRow = dispatcher.user.settings.show_versions ? (
            <tr>
                <td><b>Database Version</b></td>
                <td>{this.props._version}</td>
            </tr>
        ): null;


        return (
            <div>
                <h5><strong><Icon name='tag' /> General </strong></h5>

                <Table bordered>
                    <tbody>
                        <tr>
                            <td className='col-md-4'><b>Task</b></td>
                            <td className='col-md-8'>{_.startCase(this.props.task)}</td>
                        </tr>
                        {jobIdRow}
                        {jobVersionRow}
                        <tr>
                            <td><b>Arguments</b></td>
                            <td><TaskArgs taskArgs={this.props.args} /></td></tr>
                        <tr>
                            <td><b>CPUs</b></td>
                            <td> {this.props.proc}</td></tr>
                        <tr>
                            <td><b>Memory</b></td>
                            <td> {this.props.mem} GB</td>
                        </tr>
                    </tbody>
                </Table>
            </div>
        );
    }

});

module.exports = JobDetailGeneral;