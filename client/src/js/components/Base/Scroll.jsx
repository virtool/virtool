/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Scroll
 */

'use strict';

var Ps = require('perfect-scroller');
var React = require('react');
var Numeral = require('numeral');

var Scroll = React.createClass({

    render: function () {
        return <span>{Numeral(this.props.bytes).format('0.0 b')}</span>;
    }
});

module.exports = Scroll;