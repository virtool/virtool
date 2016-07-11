/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ActiveJobs
 */

'use strict';

var React = require('react');
var JobsTable = require('./JobsTable.jsx');

/**
 * A React component that is a simple composition of JobsTable. Applies a baseFilter that includes only active jobs.
 *
 * @class
 */
var ActiveJobs = React.createClass({

    render: function () {
        return (
            <JobsTable
                route={this.props.route}
                baseFilter={{archived: false}}
            />
        );
    }
});

module.exports = ActiveJobs;