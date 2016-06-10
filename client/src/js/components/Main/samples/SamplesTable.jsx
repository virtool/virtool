/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SamplesTable
 */

'use strict';

var React = require('react');
var Alert = require('react-bootstrap/lib/Alert');

var DynamicTable = require('virtool/js/components/Base/DynamicTable/DynamicTable.jsx');
var RelativeTime = require('virtool/js/components/Base/RelativeTime.jsx');
var ConfirmModal = require('virtool/js/components/Base/ConfirmModal.jsx');
var ConfirmManagerMixin = require('virtool/js/components/Base/Mixins/ConfirmManagerMixin');
var DetailModal = require('virtool/js/components/Base/DetailModal.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');

var Detail = require('./Detail/body.jsx');
var Filter = require('./Filter.jsx');
var Toolbar = require('./Toolbar.jsx');

/**
 * A checkbox-based Icon class. If the operation is a bool, the checkbox is checked to when true. The only acceptable
 * string value is 'ip', indicating the operation is in progress. A spinner is rendered in this case.
 *
 * @class
 */
var StateCheckbox = React.createClass({

    propTypes: {
        // State of the sample operation: true, false, or 'ip'.
        operationState: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.bool])
    },

    render: function () {
        return (
            <Icon
                name={this.props.operationState === true ? 'checkbox-checked': 'checkbox-unchecked'}
                pending={this.props.operationState === 'ip'}
            />
        );
    }
});

/**
 * A component based on DynamicTable that displays sample documents and allows them to be removed, archived, and viewed in
 * detail in a modal.
 *
 * @class
 */
var SamplesTable = React.createClass({

    mixins: [ConfirmManagerMixin],
    
    propTypes: {
        collection: React.PropTypes.object.isRequired,
        archived: React.PropTypes.bool.isRequired
    },

    getInitialState: function () {
        return {detailTarget: null};
    },

    /**
     * Hides the detail modal. Triggered as the onHide prop function passed to the modal.
     *
     * @func
     */
    hideDetail: function () {
        this.setState({detailTarget: null});
    },

    /**
     * Handles a click event on an document. The document is
     *
     * @param target {object} - an object that targets the document that details should be fetched for.
     * @func
     */
    selectSample: function (target) {
        this.setState({detailTarget: target});
    },

    /**
     * Send a request to the server to archive the passed target(s).
     *
     * @param targets {array,object} - one or more targets to request and archive for.
     * @func
     */
    archive: function (targets) {
        if (!(targets instanceof Array)) targets = [targets];

        var callback = function () {
            // Send messages to the server asking for the target _ids to be archived.
            dispatcher.collections.samples.request('archive', {_id: _.map(targets, '_id')});
        };

        this.confirmManager.show('archive', callback, targets);
    },

    /**
     * Array of objects use to define the fields that should appear in the table.
     *
     * @array
     */
    fields: [
        {
            key: 'name',
            size: 3
        },
        {
            key: 'imported',
            label: <Icon name='filing' />,
            size: 'fit',
            render: function (document) {return <StateCheckbox operationState={document.imported} />}
        },
        {
            key: 'analyzed',
            label: <Icon name='bars' />,
            size: 'fit',
            render: function (document) {return <StateCheckbox operationState={(document.analyzed)} />}
        },
        {
            key: 'added',
            size: 2,
            render: function (document) { return <RelativeTime time={document.added} />; }
        },
        {
            key: 'username',
            size: 2,
            label: 'User'
        }
    ],

    render: function () {

        var hidden = {
            visibility: 'hidden'
        };

        // A function for rendering action icon buttons for each document and for the table header component.
        var createActions = function (documents) {

            documents = documents instanceof Array ? documents: [documents];

            var canArchive = documents.length > 0 && _.every(documents, function (document) {
                return document.archived === false && document.analyzed && (
                    document.all_write ||
                    (document.group_write && dispatcher.user.groups.indexOf(document.group) > -1) ||
                    dispatcher.user.name === document.user
                );
            });

            return <Icon
                name='box-add'
                bsStyle={canArchive ? 'info': null}
                onClick={canArchive ? function () {this.archive(documents)}.bind(this): null}
                style={canArchive ? null: hidden}
            />;

        }.bind(this);

        var tableProps = {
            collection: this.props.collection,
            fields: this.fields,
            baseFilter: {archived: this.props.archived},
            initialSortKey: 'added',
            initialSortDescending: true,
            alwaysShowFilter: !this.props.archived,
            filterComponent: this.props.archived || !dispatcher.user.permissions.add_sample ? Filter: Toolbar,
            documentsNoun: 'samples',
            selectable: true,
            onClick: this.selectSample,
            createActions: createActions
        };

        return (
            <div>
                <DynamicTable {...tableProps} />

                <ConfirmModal {...this.confirmManager.getProps()} noun='sample' />

                <DetailModal
                    target={this.state.detailTarget}
                    onHide={this.hideDetail}
                    contentComponent={Detail}
                    collection={this.props.collection}
                />
            </div>
        );
    }
});

module.exports = SamplesTable;