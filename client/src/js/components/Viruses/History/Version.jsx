/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Version
 */

'use strict';

var React = require('react');
var Label = require('react-bootstrap/lib/Label');

/**
 * Renders a given version number or string. The only valid string is 'removed'.
 *
 * @class
 */
var Version = React.createClass({

    propTypes: {
        version: React.PropTypes.oneOfType([React.PropTypes.number, React.PropTypes.string]).isRequired
    },

    shouldComponentUpdate: function () {
        // This component is render-only.
        return false;
    },

    render: function () {
        return <Label>{this.props.version === 'removed' ? 'Removed': this.props.version}</Label>;
    }
});

module.exports = Version;