/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SetupReload
 */

'use strict';

import React from "react";
import ReactDOM from "react-dom";
var Alert = require('react-bootstrap/lib/Alert');
var Button = require('react-bootstrap/lib/Button');

var Icon = require('virtool/js/components/Base/Icon');

var SetupReload = React.createClass({

    componentDidMount: function () {
        ReactDOM.findDOMNode(this.refs.button).focus();
    },

    handleClick: function () {
        this.props.saveAndReload();
    },

    render: function () {

        return (
            <div>
                <Alert bsStyle='info'>
                    Virtool is configured and must be reloaded before it can be used.
                </Alert>

                <Button ref='button' bsStyle='primary' onClick={this.handleClick} className='pull-right'>
                    <Icon name='reset' /> Accept
                </Button>
            </div>
        );
    }

});

module.exports = SetupReload;