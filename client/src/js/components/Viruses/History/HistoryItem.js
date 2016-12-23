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

'use strict';

import React from "react";
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Button = require('react-bootstrap/lib/Button');

var Version = require('./Version');
var Icon = require('virtool/js/components/Base/Icon');
var RelativeTime = require('virtool/js/components/Base/RelativeTime');

/**
 * The React classes used to render a HistoryItem for each virus editing method. Classes are keyed by their associated
 * method names.
 *
 * @object
 */
var MethodClasses = {
    add: require('./Methods/Add'),
    remove: require('./Methods/Remove'),
    set_field: require('./Methods/SetField'),
    verify_virus: require('./Methods/VerifyVirus'),
    upsert_isolate: require('./Methods/UpsertIsolate'),
    remove_isolate: require('./Methods/RemoveIsolate'),
    set_default_isolate: require('./Methods/SetDefaultIsolate'),
    add_sequence: require('./Methods/AddSequence'),
    update_sequence: require('./Methods/UpdateSequence'),
    remove_sequence: require('./Methods/RemoveSequence')
};

/**
 * A component that represents a history item. Shows the version number, method name, relative time, and a revert icon
 * if the change was made since the last index build.
 *
 * @class
 */
var HistoryItem = React.createClass({

    /**
     * Send a request to the server to revert this history document and any new changes. The new version number will be one
     * less than the version number of the history document represented by this component.
     *
     * @func
     */
    revert: function () {
        this.props.onRevert(this.props.entry_version);
    },

    render: function () {
        // Get the method React class based on the history item's method_name.
        var Method = MethodClasses[this.props.method_name];

        var revertIcon;

        // Changes that haven't been built into an index can be reverted. Render and icon button to do so. It will be
        // a spinner if the history item is pending reversion.
        if (this.props.index === 'unbuilt' && this.props.onRevert) {
            revertIcon = <Icon
                name='undo'
                bsStyle='primary'
                pending={this.props.pending}
                onClick={this.revert}
                pullRight
            />;
        }

        return (
            <div className={'list-group-item' + (this.props.pending ? ' disabled': '')}>
                <Row>
                    <Col md={1}>
                        <Version version={this.props.entry_version} />
                    </Col>
                    <Col md={9}>
                        <Method {...this.props} />
                        <span className='pull-right'>
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



});

module.exports = HistoryItem;