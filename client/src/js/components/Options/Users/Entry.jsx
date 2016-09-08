/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports UserEntry
 */

'use strict';

var React = require('react');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var PushListGroupItem = require('virtool/js/components/Base/PushListGroupItem.jsx');

/**
 * A component based on ListGroupItem
 */
var UserEntry = React.createClass({

    /**
     * Called when the component is clicked. Selects the component's user in the parent component.
     */
    handleClick: function () {
        this.props.onClick(this.props._id);
    },

    render: function () {
        return (
            <PushListGroupItem key={this.props._id} active={this.props.active} onClick={this.handleClick}>
                {this.props._id}
            </PushListGroupItem>
        );
    }
});

module.exports = UserEntry;

