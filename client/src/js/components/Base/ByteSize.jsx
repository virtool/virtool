/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ByteSize
 */

'use strict';

var React = require('react');
var Numeral = require('numeral');

var ByteSize = React.createClass({

    propTypes: {
        bytes: React.PropTypes.number.isRequired
    },

    render: function () {
        return <span>{Numeral(this.props.bytes).format('0.0 b')}</span>;
    }
});

module.exports = ByteSize;