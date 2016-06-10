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

var _ = require('lodash');
var React = require('react');
var Utils = require('virtool/js/Utils');
var Icon = require('virtool/js/components/Base/Icon.jsx');

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
        var isolateName = Utils.formatIsolateName(this.props.annotation);

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