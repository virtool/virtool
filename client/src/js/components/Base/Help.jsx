/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Help
 */

'use strict';

var CX = require('classnames');
var React = require("react");
var Popover = require('react-bootstrap/lib/Popover');
var OverlayTrigger = require('react-bootstrap/lib/OverlayTrigger');

var Icon = require('./Icon.jsx');

var Help = React.createClass({

    propTypes: {
        title: React.PropTypes.string,
        pullRight: React.PropTypes.bool
    },

    render: function () {
        var popover = (
            <Popover title={this.props.title} id='help-popover'>
                {this.props.children}
            </Popover>
        );

        var classes = CX({
            'pull-right': this.props.pullRight,
            'pointer': true
        });

        return (
            <OverlayTrigger trigger='click' placement='top' overlay={popover} rootClose>
                <span className={classes}>
                    <Icon name='question' />
                </span>
            </OverlayTrigger>
        );
    }

});

module.exports = Help;