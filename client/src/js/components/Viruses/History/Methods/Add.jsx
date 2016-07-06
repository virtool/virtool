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

var React = require('react');
var Icon = require('virtool/js/components/Base/Icon.jsx');

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