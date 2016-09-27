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
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Alert = require('react-bootstrap/lib/Alert');
var Button = require('react-bootstrap/lib/Button');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Input = require('virtool/js/components/Base/Input.jsx');

var SetupUser = React.createClass({

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
            this.refs.username.focus();
        } else {
            ReactDOM.findDOMNode(this.refs.accept).focus();
        }
    },

    handleChange: function (event) {
        var data = {};
        data[event.target.name] = event.target.value;
        this.setState(data);
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
                            <Input
                                type="text"
                                ref="username"
                                name="username"
                                label="Username"
                                onChange={this.handleChange}
                                value={this.state.username}
                            />
                        </Col>
                    </Row>
                    <Row>
                        <Col md={6}>
                            <Input
                                type="password"
                                name="password"
                                label="Password"
                                onChange={this.handleChange}
                                value={this.state.password}
                            />
                        </Col>
                        <Col md={6}>
                            <Input
                                type="password"
                                name="confirm"
                                label="Confirm Password"
                                onChange={this.handleChange}
                                value={this.state.confirm}
                            />
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