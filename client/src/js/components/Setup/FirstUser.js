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

import React from "react";
import { pick } from "lodash";
import { Row, Col, Alert } from "react-bootstrap";
import { Icon, Input, Button } from "virtool/js/components/Base";

export default class SetupUser extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            username: this.props.username,
            password: this.props.password,
            confirm: this.props.password,
        };
    }

    static propTypes = {
        username: React.PropTypes.string,
        password: React.PropTypes.string,
        hasAdmin: React.PropTypes.bool,
        accepted: React.PropTypes.bool,
        acceptedAdmin: React.PropTypes.func,
        updateSetup: React.PropTypes.func,
        nextStep: React.PropTypes.func
    };

    componentDidMount () {
        if (!this.props.hasAdmin) {
            this.usernameNode.focus();
        } else {
            this.acceptNode.focus();
        }
    }

    handleChange = (event) => {
        let data = {};
        data[event.target.name] = event.target.value;
        this.setState(data);
    };

    handleSubmit = (event) => {
        event.preventDefault();

        if (!this.props.hasAdmin && this.state.password === this.state.confirm) {
            this.props.updateSetup(pick(this.state, ["username", "password"]))
            this.props.nextStep();
        }
    };

    handleClick = () => {
        this.props.acceptedAdmin();
    };

    render () {

        if (this.props.hasAdmin) {

            let footer;

            if (this.props.accepted) {
                footer = <div style={{marginTop: "-20px"}} />;
            } else {
                footer = (
                    <Button bsStyle="primary" onClick={this.handleClick} className="pull-right" ref={this.acceptNode}>
                        <Icon name="checkmark" /> Accept
                    </Button>
                );
            }

            return (
                <div>
                    <Alert bsStyle="warning">
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
                                ref={this.usernameNode}
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

                    <Button bsStyle="primary" type="submit" className="pull-right">
                        <Icon name="floppy" /> Save
                    </Button>
                </form>
            );
        }
    }

}
