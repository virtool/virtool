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

import React from "react";
import { transform, size } from "lodash-es";
import { Icon } from "virtool/js/components/Base";

/**
 * A task arg node displaying a string or number (not expandable). Renders with a bullet point, key, and value.
 */
class StaticNode extends React.Component {

    static propTypes = {
        nodeKey: React.PropTypes.string.isRequired,
        nodeData: React.PropTypes.any
    };

    render () {
        return <li><span className="fixed-width">•</span> {this.props.nodeKey}: {this.props.nodeData}</li>;
    }

}

/**
 * A task arg node displaying a list or object (expandable). Renders with a caret indicating whether the node is
 * expanded and key-value pairs separated by a colon.
 */
class ExpandableNode extends React.Component {

    constructor (props) {
        super(props);
        this.state = { expanded: false };
    }

    static propTypes = {
        nodeKey: React.PropTypes.string.isRequired,
        nodeData: React.PropTypes.any
    };

    /**
     * Toggle expanded state. Triggered by a click event on the task arg node.
     *
     * @func
     */
    handleClick = () => {
        this.setState({
            expanded: !this.state.expanded
        });
    };

    render () {
        // Should the caret point right or down?
        const caret = <Icon name={"caret-" + (this.state.expanded ? "down": "right")} fixedWidth />;

        // This component will contain the additional nodes shown when this node is expanded.
        let expandedContent;

        if (this.state.expanded) {
            let nodeComponents;

            if (this.props.nodeData instanceof Array) {
                nodeComponents = this.props.nodeData.map((point, index) =>
                    <li key={index}><span className="fixed-width">•</span> {point}</li>
                );
            } else {
                nodeComponents = transform(this.props.nodeData, (result, value, key) => {
                    result.push(<TaskArgNode key={key + "-" + value} nodeKey={key} nodeData={value} />);
                }, []);
            }

            const listStyle = {
                listStyleType: "none",
                paddingLeft: "20px"
            };

            expandedContent = (
                <ul style={listStyle}>
                    {nodeComponents}
                </ul>
            );
        }

        return (
            <li className="pointer" onClick={this.handleClick}>
                {caret} {this.props.nodeKey} <small>({size(this.props.nodeData)})</small>
                {expandedContent}
            </li>
        );
    }

}

/**
 * A component built around StaticNode and ExpandableNode. Decides which node component should be used based on the
 * nodeData prop and renders.
 */
export default class TaskArgNode extends React.Component {

    static propTypes = {
        nodeKey: React.PropTypes.string.isRequired,
        nodeData: React.PropTypes.any
    };

    render () {
        const NodeComponent = this.props.nodeData instanceof Object ? ExpandableNode: StaticNode;
        return <NodeComponent {...this.props} />;
    }
}
