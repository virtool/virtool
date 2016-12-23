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

import React from "react";
var Icon = require('virtool/js/components/Base/Icon');

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