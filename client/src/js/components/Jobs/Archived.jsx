/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ArchivedJobs
 */

var React = require('react');
var JobsTable = require('./JobsTable.jsx');

/**
 * A React component that is a simple composition of JobsTable. Applies a baseFilter that includes only archived jobs.
 *
 * @class
 */
var ArchivedJobs = React.createClass({

    render: function () {
        return (
            <JobsTable
                route={this.props.route}
                baseFilter={{archived: true}}
            />
        );
    }
});

module.exports = ArchivedJobs;