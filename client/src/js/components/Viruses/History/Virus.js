/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports VirusHistoryList
 */

'use strict';

var _ = require('lodash');
import React from "react";
import FlipMove from "react-flip-move"
var ListGroup = require('react-bootstrap/lib/ListGroup');
var HistoryItem = require('./HistoryItem');

var RelativeTime = require('virtool/js/components/Base/RelativeTime');

/**
 * A list of HistoryItems associated with a single virusId.
 *
 * @class
 */
var VirusHistoryList = React.createClass({

    propTypes: {
        canModify: React.PropTypes.bool
    },

    getInitialState: function () {
        return {reverting: null};
    },

    componentWillReceiveProps: function (nextProps) {
        if (nextProps.history.length < this.props.history.length) this.setState(this.getInitialState());
    },

    /**
     * Revert up to and including the passed version of the virus document. All history documents being reverted will become
     * disabled and display a spinner until they are removed from the collection.
     *
     * @param version {number} - the document version to revert past.
     * @func
     */
    revert: function (version) {
        this.setState({reverting: version}, function () {
            dispatcher.db.history.request('revert', {
                entry_id: this.props.virus,
                entry_version: version
            });
        });
    },

    render: function () {

        // Generate all the history components that will be shown in the history panel for the virus.
        var historyComponents = _.sortBy(this.props.history, "entry_version").reverse().map(function (historyEntry) {
            return (
                <HistoryItem
                    key={historyEntry._id}
                    {...historyEntry}
                    collection={dispatcher.db.history}
                    pending={this.state.reverting !== null && historyEntry.entry_version >= this.state.reverting}
                    onRevert={this.props.canModify ? this.revert: null}
                />
            );
        }, this);

        return (
            <FlipMove typeName="div" className="list-group" fill={true} leaveAnimation={false} duration={200}>
                {historyComponents}
            </FlipMove>
        );
    }
});

module.exports = VirusHistoryList;