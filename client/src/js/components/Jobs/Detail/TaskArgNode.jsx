/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports TaskArgNode
 */

'use strict';

var React = require('react');
var Badge = require('react-bootstrap/lib/Badge');
var Icon = require('virtool/js/components/Base/Icon.jsx');

/**
 * A task arg node displaying a string or number (not expandable). Renders with a bullet point, key, and value.
 */
var StaticNode = React.createClass({

    propTypes: {
        nodeKey: React.PropTypes.string.isRequired,
        nodeData: React.PropTypes.any
    },

    render: function () {
        return <li><span className='fixed-width'>•</span> {this.props.nodeKey}: {this.props.nodeData}</li>;
    }
});

/**
 * A task arg node displaying a list or object (expandable). Renders with a caret indicating whether the node is
 * expanded and key-value pairs separated by a colon.
 */
var ExpandableNode = React.createClass({

    propTypes: {
        nodeKey: React.PropTypes.string.isRequired,
        nodeData: React.PropTypes.any
    },

    getInitialState: function () {
        return {expanded: false};
    },

    /**
     * Toggle expanded state. Triggered by a click event on the task arg node.
     *
     * @func
     */
    handleClick: function () {
        this.setState({expanded: !this.state.expanded});
    },

    render: function () {
        // Should the caret point right or down?
        var caret = <Icon name={'caret-' + (this.state.expanded ? 'down': 'right')} fixedWidth />;

        // This component will contain the additional nodes shown when this node is expanded.
        var expandedContent;

        if (this.state.expanded) {
            var nodeComponents;

            if (this.props.nodeData instanceof Array) {
                nodeComponents = this.props.nodeData.map(function (point, index) {
                    return <li key={index}><span className='fixed-width'>•</span> {point}</li>;
                });
            } else {
                nodeComponents = _.transform(this.props.nodeData, function (result, value, key) {
                    result.push(<TaskArgNode key={key + '-' + value} nodeKey={key} nodeData={value} />);
                }, []);
            }

            var listStyle = {
                listStyleType: 'none',
                paddingLeft: '20px'
            };

            expandedContent = (
                <ul style={listStyle}>
                    {nodeComponents}
                </ul>
            );
        }

        return (
            <li className='pointer' onClick={this.handleClick}>
                {caret} {this.props.nodeKey} <small>({_.size(this.props.nodeData)})</small>
                {expandedContent}
            </li>
        );
    }

});

/**
 * A component built around StaticNode and ExpandableNode. Decides which node component should be used based on the
 * nodeData prop and renders.
 */
var TaskArgNode = React.createClass({

    propTypes: {
        nodeKey: React.PropTypes.string.isRequired,
        nodeData: React.PropTypes.any
    },

    render: function () {
        var NodeComponent = this.props.nodeData instanceof Object ? ExpandableNode: StaticNode;
        return <NodeComponent {...this.props} />;
    }
});

module.exports = TaskArgNode;