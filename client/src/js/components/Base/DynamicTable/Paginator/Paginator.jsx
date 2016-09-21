/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Paginator
 */

'use strict';

var _ = require("lodash");
var React = require("react");
var Pagination = require('react-bootstrap/lib/Pagination');

var Paginator = React.createClass({

    propTypes: {
        page: React.PropTypes.number.isRequired, // The active page number.
        pageCount: React.PropTypes.number.isRequired, // The total number of pages.
        onChange: React.PropTypes.func.isRequired // Callback to trigger when a new page number is clicked.
    },

    /**
     * Selects a new page. The new page number is passed up to the DynamicTable component.
     *
     * @param eventKey - the new page to move to.
     */
    handleSelect: function (eventKey) {
        this.props.onChange(eventKey);
    },

    render: function () {

        var pagination;

        if (this.props.pageCount > 1) {
            pagination = (
                <Pagination
                    prev
                    next
                    first
                    last
                    ellipsis
                    items={this.props.pageCount}
                    maxButtons={10}
                    activePage={this.props.page}
                    onSelect={this.handleSelect}
                />
            )
        }

        return (
            <div className='text-center'>
                {pagination}
            </div>
        );
    }

});

module.exports = Paginator;