/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports VerifyVirusMethod
 */

'use strict';

var React = require('react');
var Icon = require('virtool/js/components/Base/Icon.jsx');

/**
 * A component that describes the verification of a virus within a HistoryItem.
 *
 * @class
 */
var VerifyVirusMethod = React.createClass({

    shouldComponentUpdate: function () {
        return false;
    },

    render: function () {
        return <span><Icon name='checkmark' bsStyle='success' /> Verified</span>;
    }

});

module.exports = VerifyVirusMethod;