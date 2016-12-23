/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SetupStep
 */

'use strict';

import React from "react";
var ListGroupItem = require('virtool/js/components/Base/PushListGroupItem');

var Icon = require('virtool/js/components/Base/Icon');

var SetupStep = React.createClass({

    propTypes: {
        index: React.PropTypes.number.isRequired,
        label: React.PropTypes.string.isRequired,
        setActiveStepIndex: React.PropTypes.func.isRequired,
        ready: React.PropTypes.bool,
        disabled: React.PropTypes.bool
    },

    getDefaultProps: function () {
        return {
            ready: false,
            disabled: false
        };
    },

    handleClick: function () {
        this.props.setActiveStepIndex(this.props.index);
    },

    render: function () {

        var iconStyle = {
            marginTop: '1px',
            marginBottom: '-1px'
        };

        var icon = this.props.ready ? <Icon name='checkmark' />: null;

        return (
            <ListGroupItem disabled={this.props.disabled} onClick={this.handleClick} active={this.props.active}>
                {this.props.index + 1}. {this.props.label}
                <span style={iconStyle} className='pull-right'>
                    {icon}
                </span>
            </ListGroupItem>
        );
    }

});

module.exports = SetupStep;