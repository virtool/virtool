/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports RemoveMethod
 */

import React from "react";
var Icon = require('virtool/js/components/Base/Icon');

/**
 * A history method component for removing a virus.
 *
 * @class
 */
var RemoveMethod = React.createClass({

    shouldComponentUpdate: function () {
        // Component is pure render.
        return false;
    },

    render: function () {
        return (
            <span>
                <Icon name='remove' bsStyle='danger' />
                <span> Removed virus <em>{this.props.changes.name} ({this.props.changes._id})</em></span>
            </span>
        );
    }

});

module.exports = RemoveMethod;