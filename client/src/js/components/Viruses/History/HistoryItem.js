/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports HistoryItem
 */

import React from "react";
import { Label, Row, Col } from "react-bootstrap";
import { Icon, RelativeTime } from "virtool/js/components/Base";
import * as Methods from "./Methods";

const MethodClasses = {
    add: Methods.AddMethod,
    remove: Methods.RemoveMethod,
    set_field: Methods.SetFieldMethod,
    verify_virus: Methods.VerifyVirusMethod,
    upsert_isolate: Methods.UpsertIsolateMethod,
    remove_isolate: Methods.RemoveIsolateMethod,
    set_default_isolate: Methods.SetDefaultIsolateMethod,
    add_sequence: Methods.AddSequenceMethod,
    update_sequence: Methods.UpdateSequenceMethod,
    remove_sequence: Methods.RemoveSequenceMethod
};

/**
 * Renders a given version number or string. The only valid string is "removed".
 *
 * @class
 */
const Version = props => (
    <Label>{props.version === "removed" ? "Removed": props.version}</Label>
);

Version.propTypes = {
    version: React.PropTypes.oneOfType([React.PropTypes.number, React.PropTypes.string]).isRequired
};


/**
 * A component that represents a history item. Shows the version number, method name, relative time, and a revert icon
 * if the change was made since the last index build.
 *
 * @class
 */
export default class HistoryItem extends React.Component {

    static propTypes = {
        onRevert: React.PropTypes.func.isRequired,
        pending: React.PropTypes.bool.isRequired,
        index: React.PropTypes.oneOfType([React.PropTypes.number, React.PropTypes.string]).isRequired,
        index_version: React.PropTypes.oneOfType([React.PropTypes.number, React.PropTypes.string]).isRequired,
        entry_version: React.PropTypes.oneOfType([React.PropTypes.number, React.PropTypes.string]).isRequired,
        method_name: React.PropTypes.string.isRequired,
        timestamp: React.PropTypes.string.isRequired,
        username: React.PropTypes.string.isRequired
    };

    /**
     * Send a request to the server to revert this history document and any new changes. The new version number will be
     * one less than the version number of the history document represented by this component.
     *
     * @func
     */
    revert = () => {
        this.props.onRevert(this.props.entry_version);
    };

    render () {

        let revertIcon;

        // Changes that haven"t been built into an index can be reverted. Render and icon button to do so. It will be
        // a spinner if the history item is pending reversion.
        if (this.props.index === "unbuilt" && this.props.onRevert) {
            revertIcon = <Icon
                name="undo"
                bsStyle="primary"
                pending={this.props.pending}
                onClick={this.revert}
                pullRight
            />;
        }

        // Get the method React class based on the history item"s method_name.
        const Method = MethodClasses[this.props.method_name];

        return (
            <div className={`list-group-item${this.props.pending ? " disabled": ""}`}>
                <Row>
                    <Col md={1}>
                        <Version version={this.props.entry_version} />
                    </Col>
                    <Col md={9}>
                        <Method {...this.props} />
                        <span className="pull-right">
                            <RelativeTime time={this.props.timestamp} /> by {this.props.username}
                        </span>
                    </Col>
                    <Col md={2}>
                        {revertIcon}
                    </Col>
                </Row>
            </div>
        );
    }
}
