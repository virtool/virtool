/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Row
 */

'use strict';

var CX = require('classnames');
var React = require('react');
var ReactCSSTransitionGroup = require('react-addons-css-transition-group');
var Checkbox = require('virtool/js/components/Base/Checkbox.jsx');

/**
 * A table row component for DynamicTable that handles selection and icon action buttons.
 */
var Row = React.createClass({

    propTypes: {
        _id: React.PropTypes.string.isRequired,
        selected: React.PropTypes.bool,
        onSelect: React.PropTypes.func
    },

    /**
     * Select the document associated with this row. Triggered by a click event on the table row excepting the action
     * buttons.
     *
     * @param event {object} - the click event
     */
    onSelect: function (event) {
        this.props.onSelect(this.props._id, !this.props.selected, event.shiftKey);
    },

    render: function () {

        var selectedRow = CX({
            active: this.props.selected,
            'shadow-hover': true
        });

        var selector;

        // Include a selecting checkbox if the onSelect prop is defined.
        if (this.props.onSelect) {
            selector = (
                <td className='cell-fit pointer' onClick={this.onSelect}>
                    <Checkbox checked={this.props.selected} />
                </td>
            );
        }

        return (
            <ReactCSSTransitionGroup transitionName='tableRow' transitionEnterTimeout={300} transitionLeaveTimeout={300} component='tr' className={selectedRow}>
                {selector}
                {this.props.children}
            </ReactCSSTransitionGroup>
        );
    }
});

module.exports = Row;
