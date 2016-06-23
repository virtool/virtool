/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports DynamicTable
 */

'use strict';

var _ = require('lodash');
var React = require('react');
var Panel = require('react-bootstrap/lib/Panel');

var Table = require('./Table/Table.jsx');
var Paginator = require('./Paginator/Paginator.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');

/**
 * A reusable interactive table component that is used to display the data managed by Virtool. The main interactive
 * features are a paginator, filter functionality, and selection.
 *
 * @class
 */
var DynamicTable = React.createClass({

    propTypes: {
        collection: React.PropTypes.object.isRequired,

        // An array of objects used to control how field labels and data are displayed.
        fields: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
        initialSortKey: React.PropTypes.string,
        initialSortDescending: React.PropTypes.bool,
        perPage: React.PropTypes.number,

        // Filtering parameters.
        baseFilter: React.PropTypes.object,
        filterElement: React.PropTypes.element,
        alwaysShowFilter: React.PropTypes.bool,

        // Other customization.
        documentsNoun: React.PropTypes.string,

        // Enable or disable capabilities.
        selectable: React.PropTypes.bool,
        sortable: React.PropTypes.bool,
        pageable: React.PropTypes.bool,

        // Callback to execute when a row is clicked.
        onClick: React.PropTypes.func
    },

    getDefaultProps: function () {
        return {
            perPage: 25,
            baseFilter: null,
            alwaysShowFilter: false,
            documentsNoun: 'documents',
            selectable: false,
            sortable: true,
            pageable: true,
            initialSortKey: '_id',
            initialSortDescending: true
        };
    },

    getInitialState: function () {
        return {
            // The filter to apply to the data documents.
            filter: null,
            page: 1,
            sortKey: this.props.initialSortKey,
            sortDescending: this.props.initialSortDescending,
            selected: []
        };
    },

    componentWillMount: function () {
        this.refresh();
    },

    componentDidMount: function () {
        this.props.collection.on('change', this.refresh);
    },

    componentWillUnmount: function () {
        // Stop listening to collection updates.
        this.props.collection.off('change', this.refresh);
    },

    /**
     * Set the 'selected' field on one or more documents.
     *
     * @param selection {String/Array} - the document id or list of document ids to set selected for.
     * @param selected {Boolean} - how to set selected (true, false)
     */
    select: function (selection, selected) {
        if (selection.constructor !== Array) selection = [selection];

        if (selected) {
            this.setState({selected: _.union(this.state.selected, selection)});
        } else {
            this.setState({selected: _.difference(this.state.selected, selection)});
        }
    },

    /**
     * Update the filter applied to the collection documents.
     *
     * @param filter {Array} - filter predicate functions
     */
    filter: function (filter) {
        this.setState({filter: filter});
    },

    /**
     * Sort documents by the passed field key. If the passed key is already the active sortKey, reverse the sort order.
     * The default sort order is ascending.
     *
     * @param key {String} - the key of the field to sort by.
     */
    sort: function (key) {
        this.setState({
            sortDescending: this.state.sortKey === key ? !this.state.sortDescending: false,
            sortKey: key
        });
    },

    /**
     * Change the page of documents to view.
     *
     * @param pageNumber {Number} - the page number to go to
     */
    goToPage: function (pageNumber) {
        this.setState({page: pageNumber});
    },

    /**
     * Refresh the component by getting the latest documents from the collection. Mostly used as a callback to be
     * triggered by changes in the collection.     *
     */
    refresh: function () {
        this.setState({
            documents: this.props.collection.documents,
            selected: _.without(this.state.selected, _.map(this.props.collection.documents, '_id'))
        });
    },

    render: function () {
        
        //The filter component (form-type component) to show at the top of the dynamic table. It is only rendered if
        var filterComponent;

        // Get the initial set of documents. Apply the baseFilter if there is one.
        var documents = this.props.baseFilter ? _.filter(this.state.documents, this.props.baseFilter): this.state.documents;

        // Render the filterComponent passed in props if there is one and if there are any documents left after base
        // filter.
        if (this.props.filterComponent && (documents.length > 0 || this.props.alwaysShowFilter)) {
            filterComponent = (
                <this.props.filterComponent
                    documents={documents}
                    onChange={this.filter}
                    filter={this.state.filter}
                />
            );
        }

        // If any documents are present, display them. Otherwise a 'no documents' panel will be rendered.
        if (documents.length > 0) {

            // Apply the filter if one is defined.
            if (this.state.filter) documents = _.filter(documents, this.state.filter, this);

            if (documents.length > 0) {
                // Sort the data based on the clicked column headers
                documents = _.sortBy(documents, this.state.sortKey);

                // The props that will be passed to table element. Likely to be further modified before they are
                // actually passed.
                var tableProps = {
                    fields: this.props.fields,
                    onClick: this.props.onClick,
                    documents: [],
                    selected: this.state.selected,
                    sortKey: this.state.sortKey,
                    sortDescending: this.state.sortDescending,
                    createActions: this.props.createActions
                };

                var footer;

                // Reverse the order of the sort if required.
                if (this.state.sortDescending) documents = documents.reverse();

                if (this.props.pageable) {
                    // Get a rough number of pages.
                    var roughPageCount = documents.length / this.props.perPage;

                    // If pageCount is less than 1, set pageCount to 1 otherwise round the pageCount to the nearest whole number.
                    var pageCount = roughPageCount >= 1 ? Math.ceil(roughPageCount): 1;

                    // Determine the indexes of the slice of documents that should be taken to generate the page.
                    var endIndex = this.state.page * this.props.perPage;
                    var startIndex = endIndex - this.props.perPage;

                    // The documents that make up the page.
                    tableProps.documents = documents.slice(startIndex, endIndex);

                    // The paginator only gets rendered when the pageable prop is set to true.
                    footer = <Paginator onChange={this.goToPage} pageCount={pageCount} page={this.state.page}/>;
                }

                // Only set pass the onSort and onSelect functions to the table component when those abilities are
                // enabled for the DynamicTable. If the functions are undefined in children they will behave
                // appropriately.
                if (this.props.selectable) tableProps.onSelect = this.select;
                if (this.props.sortable) tableProps.onSort = this.sort;

                return (
                    <div>
                        {filterComponent}
                        <Table {...tableProps} />
                        {footer}
                    </div>
                );
            }


        }

        // If that table isn't rendered because there are no documents,
        return (
            <div>
                {filterComponent}
                <Panel className='text-center'>
                    <Icon name='notification' /> No {this.props.documentsNoun} found
                </Panel>
            </div>
        );
    }
});

module.exports = DynamicTable;