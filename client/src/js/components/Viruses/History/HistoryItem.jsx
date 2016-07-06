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

var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Button = require('react-bootstrap/lib/Button');

var Version = require('./Version.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var RelativeTime = require('virtool/js/components/Base/RelativeTime.jsx');

/**
 * The React classes used to render a HistoryItem for each virus editing method. Classes are keyed by their associated
 * method names.
 *
 * @object
 */
var MethodClasses = {
    add: require('./Methods/Add.jsx'),
    remove: require('./Methods/Remove.jsx'),
    set_field: require('./Methods/SetField.jsx'),
    verify_virus: require('./Methods/VerifyVirus.jsx'),
    upsert_isolate: require('./Methods/UpsertIsolate.jsx'),
    remove_isolate: require('./Methods/RemoveIsolate.jsx'),
    set_default_isolate: require('./Methods/SetDefaultIsolate.jsx'),
    add_sequence: require('./Methods/AddSequence.jsx'),
    update_sequence: require('./Methods/UpdateSequence.jsx'),
    remove_sequence: require('./Methods/RemoveSequence.jsx')
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