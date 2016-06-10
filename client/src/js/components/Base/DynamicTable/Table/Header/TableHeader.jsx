/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports TableHeader
 */

'use strict';

var _ = require('lodash');
var React = require('react');
var ColumnHeader = require('./ColumnHeader.jsx');
var Checkbox = require("virtool/js/components/Base/Checkbox.jsx");

/**
 * A thead-based component that serves as the header for the DynamicTable component.
 */
var TableHeader = React.createClass({

    propTypes: {
        // An array of objects that described the headers to display.
        fields: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,

        // Functions to call when the select all checkbox is clicked or a ColumnHeader is clicked.
        onSelectAll: React.PropTypes.func,
        onSort: React.PropTypes.func,

        // The key to sort by and the direction to sort in.
        sortKey: React.PropTypes.string,
        sortDescending: React.PropTypes.bool
    },

    render: function () {

        // Is every rendered document selected?
        var allSelected = this.props.documents.length === this.props.selected.length;

        // Are any rendered documents selected?
        var someSelected = this.props.selected.length > 0;

        // The th components to be rendered in the header component. Their contents are defined by the fields prop.
        var titleComponents = this.props.fields.map(function (field) {
            // Is this fieldKey sorting the table?
            var sorting = field.key === this.props.sortKey;

            return (
                <ColumnHeader
                    key={field.key}
                    fieldKey={field.key}
                    label={field.label}
                    size={field.size}
                    onSort={this.props.onSort}
                    sorting={sorting}
                    descending={this.props.sortDescending}
                />
            );
        }, this);

        var selector;

        // Render a selectAll checkbox if the onSelectAll prop is defined.
        if (this.props.onSelectAll) {
            selector = (
                <th className='cell-fit pointer' onClick={this.props.onSelectAll}>
                    <Checkbox checked={allSelected} partial={someSelected} />
                </th>
            );
        }

        var actions;

        // Add action buttons to each document if a createActions function is defined in props.
        if (this.props.createActions) {
            var icons;

            var selectedEntries = _.filter(this.props.documents, function (document) {
                return this.props.selected.indexOf(document._id) !== -1;
            }.bind(this));

            if (this.props.onSelectAll) icons = this.props.createActions(selectedEntries);

            actions = (
                <th className='cell-fit pointer'>
                    {icons}
                </th>
            );
        }

        return (
            <thead>
                <tr>
                    {selector}
                    {titleComponents}
                    {actions}
                </tr>
            </thead>
        );
    }

});

module.exports = TableHeader;