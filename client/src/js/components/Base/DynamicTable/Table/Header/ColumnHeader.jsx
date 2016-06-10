/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ColumnHeader
 */

'use strict';

var _ = require('lodash');
var React = require('react');
var Icon = require('virtool/js/components/Base/Icon.jsx');

var ColumnHeader = React.createClass({

    propTypes: {
        label: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.element]),
        size: React.PropTypes.oneOfType([React.PropTypes.number, React.PropTypes.string]),
        onSort: React.PropTypes.func,
        sorting: React.PropTypes.bool,
        descending: React.PropTypes.bool
    },

    /**
     * Calls the onSort prop function and passed the fieldKey associated with this component. Triggered by clicking the
     * column header.
     *
     * @func
     */
    sort: function () {
        this.props.onSort(this.props.fieldKey);
    },

    render: function () {
        var caret;

        // Render a caret if the table is being sorted by the fieldKey associated with this ColumnHeader.
        if (this.props.sorting) {
            caret = <span> <Icon name={'caret-' + (this.props.descending ? 'up': 'down')} /></span>;
        }

        // Fit the cell to its content is the size prop equals 'fit'. Otherwise use the bootstrap col-md- class to set
        // the cell size.
        var headProps = {
            className: this.props.size === 'fit' ? 'cell-fit': ('col-md-' + this.props.size)
        };

        // If the onSort prop is set, make the header sortable.
        if (this.props.onSort) {
            headProps.onClick = this.sort;
            headProps.className += ' hoverable pointer';
        }

        return (
            <th {...headProps}>
                {_.includes([undefined, null], this.props.label) ? _.capitalize(this.props.fieldKey): this.props.label}
                {caret}
            </th>
        );
    }

});

module.exports = ColumnHeader;