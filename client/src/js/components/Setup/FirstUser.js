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
import { Input, Button } from "virtool/js/components/Base";

export default class SetupFirstUser extends React.Component {

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
        (this.props.hasAdmin ? this.acceptNode : this.usernameNode).focus();
    }

    handleSubmit = (event) => {
        event.preventDefault();

        if (!this.props.hasAdmin && this.state.password === this.state.confirm) {
            this.props.updateSetup(pick(this.state, ["username", "password"]))
            this.props.nextStep();
        }
    };

    render () {

        if (this.props.hasAdmin) {

            let footer;

            if (this.props.accepted) {
                footer = <div style={{marginTop: "-20px"}} />;
            } else {
                footer = (
                    <Button
                        bsStyle="primary"
                        icon="checkmark"
                        ref={(node) => this.acceptNode = node}
                        onClick={() => this.props.acceptedAdmin()}
                        pullRight
                    >
                        Accept
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
                                ref={(node) => this.usernameNode = node}
                                label="Username"
                                onChange={(event) => this.setState({username: event.target.value})}
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
                                onChange={(event) => this.setState({password: event.target.value})}
                                value={this.state.password}
                            />
                        </Col>
                        <Col md={6}>
                            <Input
                                type="password"
                                name="confirm"
                                label="Confirm Password"
                                onChange={(event) => this.setState({confirm: event.target.value})}
                                value={this.state.confirm}
                            />
                        </Col>
                    </Row>

                    <Button type="submit" icon="floppy" bsStyle="primary" pullRight>
                        Save
                    </Button>
                </form>
            );
        }
    }

}
