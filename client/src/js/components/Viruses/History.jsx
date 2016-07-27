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
var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Input = require('react-bootstrap/lib/Input');
var Panel = require('react-bootstrap/lib/Panel');
var PanelGroup = require('react-bootstrap/lib/PanelGroup');

var Control = require('./History/Control.jsx');
var Pager = require('./History/Pager.jsx');
var RelativeTime = require('virtool/js/components/Base/RelativeTime.jsx');

/**
 * A component that shows the history of changes made to viruses in the database.
 *
 * @class
 */
var VirusHistory = React.createClass({

    getInitialState: function () {
        return {
            documents: dispatcher.db.history.documents,
            indexVersion: 'unbuilt',
            filter: null
        };
    },

    componentDidMount: function () {
        dispatcher.db.history.on('change', this.update);
    },

    componentWillUnmount: function () {
        dispatcher.db.history.off('change', this.update);
    },

    /**
     * Apply a virus name filter to the history documents. Called when the value of the filter input element changes.
     *
     * @param event {object} - the change event use to get the new input value.
     * @func
     */
    filter: function (event) {
        this.setState({filter: event.target.value ? new RegExp(event.target.value, 'i') : null});
    },

    /**
     * Changes state to view changes from a specific index version OR changes that are unbuilt and have no index
     * version. Called when a new version is selected from the index drop down.
     *
     * @param event {object} - the select event from the dropdown
     * @func
     */
    selectIndex: function (event) {
        var indexVersion = event.target.value === 'unbuilt' ? 'unbuilt': Number(event.target.value);
        this.setState({indexVersion: indexVersion});
    },

    /**
     * Get the latest set of documents from the history collection. Set state so this component updates.
     *
     * @func
     */
    update: function () {
        this.setState({documents: dispatcher.db.history.documents});
    },

    render: function () {

        // Get all of the different index versions from the history documents.
        var indexVersions = _.map(this.state.documents, 'index_version');

        _.remove(indexVersions, function (n) {return n === 'unbuilt'});

        // Get rid of duplicate index versions, sort numerically and reverse the order.
        indexVersions = _.uniq(indexVersions).sort(function (a,b) {
            return a - b;
        });

        // Add the 'unbuilt' version number which will show unbuilt changes when selected.
        indexVersions.push('unbuilt');

        indexVersions.reverse();

        // Get the history documents with the selected index_version.
        var filtered = _.filter(this.state.documents, function (document) {
            var filterResult = true;

            if (this.state.filter) filterResult = this.state.filter.test(document.virus);

            return  filterResult && document.index_version === this.state.indexVersion;
        }.bind(this));

        // Group the history documents by virus_id. The history documents will be grouped into virus-specific panels.
        var grouped = _.groupBy(filtered, function (document) {
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
                    selectedVersion={this.state.indexVersion}
                />

                <Pager documents={sorted} />
            </div>
        )
    }
});

module.exports = VirusHistory;