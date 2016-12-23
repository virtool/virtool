/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ProgressTable
 */

import { Icon } from "virtool/js/components/Base";

import React from "react";
var Table = require('react-bootstrap/lib/Table');
var Panel = require('react-bootstrap/lib/Panel');

var ProgressEntry = require('./ProgressEntry');

'use strict';

/**
 * A table the shows the status update for a VT job.
 */
var ProgressTable = React.createClass({

    shouldComponentUpdate: function (nextProps) {
        return this.props.status !== nextProps.status;
    },

    render: function () {

        var statusComponents = this.props.status.map(function (document, index) {
            return <ProgressEntry key={index} {...document} />;
        });

        // This is necessary for showing the mini-ProgressBar overlay.
        var tableStyle = {
            position: 'relative'
        };

        return (
            <div>
                <h5><strong><Icon name='cog' /> Progress Log</strong></h5>
                <Panel>
                    <Table style={tableStyle} fill>
                        <thead>
                            <tr>
                                <th className="col-sm-4">Timestamp</th>
                                <th className="col-sm-3">State</th>
                                <th className="col-sm-5">Stage</th>
                            </tr>
                        </thead>
                        <tbody>
                            {statusComponents}
                        </tbody>
                    </Table>
                </Panel>
            </div>
        );
    }

});

module.exports = ProgressTable;