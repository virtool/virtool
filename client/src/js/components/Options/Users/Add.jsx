/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports AddUser
 */

'use strict';

var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Panel = require('react-bootstrap/lib/Panel');
var Popover = require('react-bootstrap/lib/Popover');
var Overlay = require('react-bootstrap/lib/Overlay');
var Modal = require('react-bootstrap/lib/Modal');
var ButtonToolbar = require('react-bootstrap/lib/ButtonToolbar');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Input = require('virtool/js/components/Base/Input.jsx');
var Checkbox = require('virtool/js/components/Base/Checkbox.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

/**
 * A form for adding a new user. Defines username, role, password, and whether the new user should be forced to reset
 * their password.
 *
 * @class
 */
var AddUser = React.createClass({

    propTypes: {
        add: React.PropTypes.func.isRequired,
        onHide: React.PropTypes.func.isRequired,
        show: React.PropTypes.bool.isRequired
    },

    getInitialState: function () {
        return {
            username: '',
            password: '',
            confirm: '',
            error: false,
            forceReset: false
        };
    },

    componentWillUpdate: function (nextProps, nextState) {
        if (nextState.username !== this.state.username) {
            this.setState({error: false});
        }
    },

    modalEnter: function () {
        this.refs.username.focus();
    },

    handleChange: function (event) {
        var data = {};
        data[event.target.name] = event.target.value;
        this.setState(data);
    },

    /**
     * Send a request to the server to add a new user. Triggered by a form submit event.
     *
     * @param event {object} - the submit event
     * @func
     */
    handleSubmit: function (event) {
        event.preventDefault();

        this.props.add({
            _id: this.state.username,
            password: this.state.password,
            force_reset: this.state.forceReset
        }, this.hide, this.showError);
    },

    /**
     * Toggles the visibility of the error popover that appears when the entered username already exists.
     *
     * @func
     */
    showError: function () {
        this.setState({error: true});
    },

    dismissError: function () {
        this.setState({error: false});
    },

    hide: function () {
        this.setState(this.getInitialState(), function () {
            this.props.onHide();
        });
    },

    /**
     * Toggle whether the user should be forced to reset their password on first login.
     *
     * @func
     */
    toggleForceReset: function () {
        this.setState({forceReset: !this.state.forceReset});
    },



    render: function () {

        return (
            <Modal show={this.props.show} onHide={this.hide} onEnter={this.modalEnter}>
                <Modal.Header onHide={this.hide} closeButton>
                    Add User
                </Modal.Header>
                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        <Row>
                            <Col sm={12}>
                                <Input
                                    type='text'
                                    ref='username'
                                    name="username"
                                    label='Username'
                                    value={this.state.username}
                                    onChange={this.handleChange}
                                />
                            </Col>
                        </Row>
                        <Row>
                            <Col sm={6}>
                                <Input
                                    type='password'
                                    name="password"
                                    label='Password'
                                    value={this.state.password}
                                    onChange={this.handleChange} />
                            </Col>
                            <Col sm={6}>
                                <Input
                                    type='password'
                                    name="confirm"
                                    label='Confirm'
                                    value={this.state.confirm}
                                    onChange={this.handleChange}
                                />
                            </Col>
                        </Row>
                        <Row>
                            <Col sm={12}>
                                <div onClick={this.toggleForceReset} className='pointer'>
                                    <Checkbox checked={this.state.forceReset} /> Force user to reset password on login
                                </div>
                            </Col>
                        </Row>
                    </Modal.Body>
                    <Modal.Footer>
                        <ButtonToolbar className='pull-right'>
                            <PushButton onClick={this.hide}>
                                Cancel
                            </PushButton>
                            <PushButton bsStyle='primary' type='submit'>
                                <Icon name='floppy' /> Save
                            </PushButton>
                        </ButtonToolbar>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
});

module.exports = AddUser;