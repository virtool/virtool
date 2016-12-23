/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Radio
 */

'use strict';

import React from "react";
var Icon = require('./Icon');

/**
 * A component that displays a icon-based radio button. The fill of the radio button depends on the 'checked' prop.
 */
var Radio = React.createClass({

    propTypes: {
        checked: React.PropTypes.bool.isRequired,
        onClick: React.PropTypes.func
    },

    getDefaultProps: function () {
        return {onClick: function () {}};
    },

    render: function () {
        // Set the icon class to 'i-radio-checked' if checked is true, otherwise set it to 'i-radio-unchecked'
        return <Icon onClick={this.props.onClick} name={'radio-' + (this.props.checked ? 'checked': 'unchecked')} />;
    }

});

module.exports = Radio;