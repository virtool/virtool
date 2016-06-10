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

var CX = require('classnames');
var React = require('react');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var PushListGroupItem = require('virtool/js/components/Base/PushListGroupItem.jsx');

/**
 * A component based on ListGroupItem
 */
var UserEntry = React.createClass({

    shouldComponentUpdate: function (nextProps) {
        return nextProps !== this.props;
    },

    /**
     * Called when the component is clicked. Selects the component's user in the parent component.
     */
    handleClick: function () {
        this.props.handleSelect(this.props._id);
    },

    render: function () {

        var classes = CX({
            'band': !this.props.disabled && (this.props._id === this.props.activeId),
            'pointer': true
        });

        var adminIcon;

        // Show a key icon next to the user's name if they are an administrator.
        if (this.props.admin) {
            var adminStyle = {
                marginTop: '2px',
                marginRight: '-5px'
            };

            adminIcon = <Icon name='key' style={adminStyle} pullRight />;
        }

        var listGroupItemProps = {
            onClick: this.handleClick,
            onFocus: this.handleFocus,
            key: this.props._id,
            className: classes,
            disabled: this.props.disabled
        };

        return (
            <PushListGroupItem {...listGroupItemProps}>
                <span>{this.props._id}</span>
                {adminIcon}
            </PushListGroupItem>
        );
    }
});

module.exports = UserEntry;

