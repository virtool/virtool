/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports VirusHistory
 */

'use strict';

var _ = require('lodash');
import React from "react";
var Control = require('./History/Control');
var Pager = require('./History/Pager');

/**
 * A component that shows the history of changes made to viruses in the database.
 *
 * @class
 */
var VirusHistory = React.createClass({

    getInitialState: function () {
        var indexVersion = this.props.route.extra[0] || "unbuilt";

        if (indexVersion !== "unbuilt") indexVersion = Number(indexVersion);

        return {
            filter: "",
            documents: dispatcher.db.history.chain().find({index_version: indexVersion})
        };
    },

    componentDidMount: function () {
        dispatcher.db.history.on("change", this.update);
    },

    componentWillReceiveProps: function (nextProps) {
        if (!_.isEqual(this.props.route, nextProps.route)) this.update(null, nextProps.route);
    },

    componentWillUnmount: function () {
        dispatcher.db.history.off("change", this.update);
    },

    /**
     * Apply a virus name filter to the history documents. Called when the value of the filter input element changes.
     *
     * @param event {object} - the change event use to get the new input value.
     * @func
     */
    filter: function (event) {
        this.setState({filter: event.target.value || null});
    },

    update: function (event, route) {
        route = route || this.props.route;

        var indexVersion = route.extra[0] || "unbuilt";

        if (indexVersion !== "unbuilt") indexVersion = Number(route.extra[0]);

        this.setState({
            documents: dispatcher.db.history.chain().find({index_version: indexVersion})
        })
    },

    render: function () {

        // Get all of the different index versions from the history documents.
        var indexVersions = _.uniq(dispatcher.db.history.extract("index_version"));

        _.pull(indexVersions, 'unbuilt');

        // Get rid of duplicate index versions, sort numerically and reverse the order.
        indexVersions = indexVersions.sort(function (a,b) {
            return a - b;
        });

        // Add the 'unbuilt' version number which will show unbuilt changes when selected.
        indexVersions.push('unbuilt');

        indexVersions.reverse();

        var indexVersion = this.props.route.extra[0];

        if (indexVersion === undefined) indexVersion = "unbuilt";

        if (indexVersion !== "unbuilt") indexVersion = Number(indexVersion);

        var documents = this.state.documents.copy();

        if (this.state.filter) {
            documents.find({
                virus: {
                    "$regex": [this.state.filter, "i"]
                }
            });
        }

        documents = documents.data();

        // Group the history documents by virus_id. The history documents will be grouped into virus-specific panels.
        var grouped = _.groupBy(documents, function (document) {
            return document.entry_id;
        });

        // Sort the grouped history by ascending virus name.
        var sorted = _.transform(grouped, function (result, history, virusId) {

            var sortedHistory = _.sortBy(history, 'document_version').reverse();

            result.push({
                virusId: virusId,
                virusName: sortedHistory[0].virus,
                history: sortedHistory
            });

        }, []);

        sorted = _.sortBy(sorted, 'virusName');

        return (
            <div>
                <Control
                    onFilter={this.filter}
                    onSelectIndex={this.selectIndex}
                    indexVersions={indexVersions}
                    selectedVersion={indexVersion}
                />

                <Pager documents={sorted} />
            </div>
        )
    }
});

module.exports = VirusHistory;