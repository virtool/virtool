/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports AddMethod
 */

import React from "react";
var Icon = require('virtool/js/components/Base/Icon');

/**
 * A history method component for adding a virus.
 *
 * @class
 */
var AddMethod = React.createClass({

    shouldComponentUpdate: function () {
        // Component is pure render.
        return false;
    },

    render: function () {
        return (
            <span>
                <Icon name='new-entry' bsStyle='primary' />
                <span> Added virus <em>{this.props.changes.name} ({this.props.changes._id})</em></span>
            </span>
        );
    }

});

module.exports = AddMethod;