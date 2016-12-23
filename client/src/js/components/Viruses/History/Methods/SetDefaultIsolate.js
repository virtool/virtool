/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SetDefaultIsolateMethod
 */

'use strict';

import { formatIsolateName } from "virtool/js/utils";

var _ = require('lodash');
import React from "react";
var Icon = require('virtool/js/components/Base/Icon');

/**
 * Describe a change in default isolate. Tells what the new default isolate is.
 *
 * @class
 */
var SetDefaultIsolateMethod = React.createClass({

    shouldComponentUpdate: function () {
        return false;
    },

    render: function () {
        // Get the isolate name from the change annotation (new default isolate).
        var isolateName = formatIsolateName(this.props.annotation);

        return (
            <span>
                <Icon name='lab' bsStyle='warning' />
                <span> Changed default isolate to </span>
                <em>{isolateName} ({this.props.annotation.isolate_id})</em>
            </span>
        );
    }

});

module.exports = SetDefaultIsolateMethod;