/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports PushButton
 */

'use strict';

var React = require('react');
var Button = require('react-bootstrap/lib/Button');
var Tooltip = require('react-bootstrap/lib/Tooltip');
var OverlayTrigger = require('react-bootstrap/lib/OverlayTrigger');

/**
 * A react-bootstrap button that does not retain focus when clicked.
 */
var PushButton = React.createClass({

    propTypes: {
        tip: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.element]),
        tipPlacement: React.PropTypes.oneOf(["top", "right", "bottom", "left"])
    },

    getDefaultProps: function () {
        return {
            pullRight: false
        };
    },

    /**
     * Function to call when the button becomes focused. Immediately blurs focus.
     *
     * @param event - the focus event
     */
    blur: function (event) {
        event.target.blur();
    },

    render: function () {
        var props = _.omit(this.props, "pullRight", "tip", "tipPlacement");

        var button = (
            <Button
                {...props}
                onFocus={this.blur}
                className={this.props.pullRight ? 'pull-right': null}
            />
        );

        if (this.props.tip) {

            var tooltip = (
                <Tooltip id={this.props.tip}>
                    {this.props.tip}
                </Tooltip>
            );

            return (
                <OverlayTrigger placement={this.props.tipPlacement || "top"} overlay={tooltip}>
                    {button}
                </OverlayTrigger>
            )
        }

        return button;
    }

});

module.exports = PushButton;