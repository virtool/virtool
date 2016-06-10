/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SelectableTable
 */

'use strict';

var _ = require('lodash');
var React = require('react');
var Table = require('react-bootstrap/lib/Table');

var TableHeader = require('./Header/TableHeader.jsx');
var TableBody = require('./Body/Body.jsx');

/**
 * The table component of the DynamicTable component. Displays documents and manages selecting.
 */
var SelectableTable = React.createClass({

    propTypes: {
        documents: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
        fields: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,

        onSelect: React.PropTypes.func,
        onSort: React.PropTypes.func,

        sortKey: React.PropTypes.string,
        sortDescending: React.PropTypes.bool
    },


    /**
     * Select or deselect all documents by setting their 'selected' property. Triggered in response to clicked the all
     * checkbox in the header of the table.
     *
     * @func
     */
    selectAll: function () {
        // Send up the list of document ids and new selected value.
        this.props.onSelect(_.map(this.props.documents, '_id'), this.props.selected < this.props.documents.length);
    },

    render: function () {
        return (
            <Table className='disable-select'>
                <TableHeader {...this.props} onSelectAll={this.props.onSelect ? this.selectAll: null} />
                <TableBody {...this.props} />
            </Table>
        );
    }
});

module.exports = SelectableTable;