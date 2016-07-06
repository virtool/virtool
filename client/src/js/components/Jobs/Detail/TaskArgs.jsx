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

'use strict';

var _ = require('lodash');
var React = require('react');

var TaskArgNode = require('./TaskArgNode.jsx');

/**
 * A component that renders a job's task args as a human-readable nested list.
 */
var TaskArgs = React.createClass({

    propTypes: {
        taskArgs: React.PropTypes.object.isRequired
    },

    shouldComponentUpdate: function () {
        return false;
    },

    render: function () {
        // Render the first level nodes of the task args object.
        var nodeComponents = _.transform(this.props.taskArgs, function (result, value, key) {
            result.push(<TaskArgNode key={value + '-' + key} nodeKey={key} nodeData={value} />);
        }, []);

        // The first level of the list should have no left margin (vs. default 40px) and no bullets.
        var listStyle = {
            listStyleType: 'none',
            paddingLeft: 0
        };

        return <ul style={listStyle}>{nodeComponents}</ul>;
    }
});

module.exports = TaskArgs;