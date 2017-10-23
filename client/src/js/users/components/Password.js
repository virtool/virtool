/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports AdminChangePassword
 */

import React from "react";
import CX from "classnames";
import { connect } from "react-redux";
import { Row, Col, Alert, Panel, ButtonToolbar } from "react-bootstrap";

import { setForceReset, setPassword } from "../actions";
import { Input, Checkbox, Button, RelativeTime } from "../../base";

const getInitialState = () => {
    return {
        newPassword: "",
        confirmPassword: "",
        error: false
    };
};

class Password extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    componentWillReceiveProps (nextProps) {
        if (this.props.last_password_change !== nextProps.last_password_change) {
            this.setState(getInitialState());
        }
    }

    componentWillUnmount () {
        this.setState({
            newPassword: "",
            confirmPassword: ""
        });
    }

    handleSubmit = (event) => {
        event.preventDefault();

        if (this.state.newPassword === this.state.confirmPassword) {
            this.props.onSubmit(this.props.id, this.state.newPassword);
        } else {
            this.setState({
                error: true
            });
        }
    };

    render () {
        let alert;

        if (this.props.error) {
            alert = (
                <Alert bsStyle="danger">
                    {this.props.error}
                </Alert>
            );
        }

        return (
            <Panel>
                <p>
                    <em>Last changed </em>
                    <RelativeTime time={this.props.last_password_change} em={true}/>
                </p>

                <form onSubmit={this.handleSubmit}>
                    <Row>
                        <Col xs={16} md={6}>
                            <Input
                                type="password"
                                name="password"
                                placeholder="New Password"
                                value={this.state.newPassword}
                                onChange={(e) => this.setState({
                                    newPassword: e.target.value,
                                    error: this.state.error && this.state.newPassword === this.state.confirmPassword
                                })}
                            />
                        </Col>

                        <Col xs={12} md={6}>
                            <Input
                                type="password"
                                name="confirm"
                                placeholder="Confirm Password"
                                value={this.state.confirmPassword}
                                onChange={(e) => this.setState({
                                    confirmPassword: e.target.value,
                                    error: this.state.error && this.state.newPassword === this.state.confirmPassword
                                })}
                            />
                        </Col>
                    </Row>
                    <Row>
                        <Col xs={12} md={6}>
                            <Checkbox
                                label="Force user to reset password on next login"
                                checked={this.props.force_reset}
                                onClick={() => this.props.onSetForceReset(
                                    this.props.id,
                                    !this.props.force_reset
                                )}
                            />
                        </Col>

                        <Col xs={12} mdHidden lgHidden>
                            <div style={{height: "15px"}}/>
                        </Col>

                        <Col xs={12} md={6}>
                            <ButtonToolbar className="pull-right">
                                <Button
                                    type="button"
                                    onClick={() => this.setState({confirmPassword: "", newPassword: ""})}
                                >
                                    Clear
                                </Button>

                                <Button
                                    icon="floppy"
                                    type="submit"
                                    bsStyle="primary"
                                >
                                    Save
                                </Button>
                            </ButtonToolbar>
                        </Col>

                        <Col xs={12} className={CX({"hidden": !this.state.error})}>
                            <h5 className="text-danger">
                                Passwords do not match
                            </h5>
                        </Col>
                    </Row>
                </form>

                {alert}
            </Panel>
        );
    }
}

const mapDispatchToProps = (dispatch) => {
    return {
        onSubmit: (userId, password) => {
            dispatch(setPassword(userId, password));
        },

        onSetForceReset: (userId, enabled) => {
            dispatch(setForceReset(userId, enabled));
        }
    };
};

const Container = connect(() => ({}), mapDispatchToProps)(Password);

export default Container;
