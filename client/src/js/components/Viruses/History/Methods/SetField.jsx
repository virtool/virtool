/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SetFieldMethod
 */

'use strict';

var React = require('react');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var RelativeTime = require('virtool/js/components/Base/RelativeTime.jsx');

/**
 * A component that described a change in a virus field: name or abbreviation.
 *
 * @class
 */
var SetFieldMethod = React.createClass({

    shouldComponentUpdate: function () {
        return false;
    },

    render: function () {
        var fieldChange = _.find(this.props.changes, function (change) {
            return change[1] == 'abbreviation' || change[1] == 'name';
        });

        var message;

        if (fieldChange[2][1]) {
            message = <span>Changed virus {fieldChange[1]} to <em>{fieldChange[2][1]}</em></span>;
        } else {
            message = <span>Removed abbrevation</span>;
        }

        return <span><Icon name='pencil' bsStyle='warning' /> {message}</span>;
    }

});

module.exports = SetFieldMethod;