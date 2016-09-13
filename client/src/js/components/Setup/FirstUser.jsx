/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SetupUser
 */

'use strict';

var React = require('react');
var ReactDOM = require('react-dom');
var LinkedStateMixin = require('react-addons-linked-state-mixin');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Alert = require('react-bootstrap/lib/Alert');
var Input = require('react-bootstrap/lib/InputGroup');
var Button = require('react-bootstrap/lib/Button');

var Icon = require('virtool/js/components/Base/Icon.jsx');

var SetupUser = React.createClass({

    mixins: [LinkedStateMixin],

    propTypes: {
        username: React.PropTypes.string,
        password: React.PropTypes.string
    },

    getInitialState: function () {
        return {
            username: this.props.username,
            password: this.props.password,
            confirm: this.props.password
        };
    },

    componentDidMount: function () {
        if (!this.props.hasAdmin) {
            this.refs.username.getInputDOMNode().focus();
        } else {
            ReactDOM.findDOMNode(this.refs.accept).focus();
        }
    },

    handleSubmit: function (event) {
        event.preventDefault();

        if (!this.props.hasAdmin && this.state.password === this.state.confirm) {
            this.props.updateSetup(_.pick(this.state, ['username', 'password']))
            this.props.nextStep();
        }
    },

    handleClick: function () {
        this.props.acceptedAdmin();
    },

    render: function () {

        if (this.props.hasAdmin) {

            var footer;

            if (this.props.accepted) {
                var divStyle = {marginTop: '-20px'};
                footer = <div style={divStyle} />;
            } else {
                footer = (
                    <Button bsStyle='primary' onClick={this.handleClick} className='pull-right' ref='accept'>
                        <Icon name='checkmark' /> Accept
                    </Button>
                );
            }

            return (
                <div>
                    <Alert bsStyle='warning'>
                        The chosen database is an existing Virtool database with one or more administrative
                        users. For security reasons, no new administrators can be added during setup. New
                        administrators can be added after setup by logging into a valid administrator account.
                    </Alert>

                    {footer}
                </div>
            );
        }

        else {
            return (
                <form onSubmit={this.handleSubmit}>
                    <Row>
                        <Col md={12}>
                            <Input ref='username' type='text' valueLink={this.linkState('username')} label='Username' />
                        </Col>
                    </Row>
                    <Row>
                        <Col md={6}>
                            <Input type='password' valueLink={this.linkState('password')} label='Password'/>
                        </Col>
                        <Col md={6}>
                            <Input type='password' valueLink={this.linkState('confirm')} label='Confirm Password'/>
                        </Col>
                    </Row>

                    <Button bsStyle='primary' type='submit' className='pull-right'>
                        <Icon name='floppy' /> Save
                    </Button>
                </form>
            );
        }
    }

});

module.exports = SetupUser;