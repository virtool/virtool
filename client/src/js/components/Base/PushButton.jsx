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

/**
 * A react-bootstrap button that does not retain focus when clicked.
 */
var PushButton = React.createClass({

    getDefaultProps: function () {
        return {
            pullRight: false
        };
    },

    /**
     * Function to call when the button beomces focused. Immediately blurs focus.
     *
     * @param event - the focus event
     */
    blur: function (event) {
        event.target.blur();
    },

    render: function () {
        return <Button {...this.props} onFocus={this.blur} className={this.props.pullRight ? 'pull-right': null} />;
    }

});

module.exports = PushButton;