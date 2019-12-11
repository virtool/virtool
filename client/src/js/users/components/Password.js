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

import CX from "classnames";
import { find, get } from "lodash-es";
import React from "react";
import { Col, Row } from "react-bootstrap";
import { connect } from "react-redux";
import { Button, ButtonToolbar, Checkbox, DangerAlert, InputError, Panel, RelativeTime, SaveButton } from "../../base";
import { editUser } from "../actions";

const getInitialState = ({ lastPasswordChange }) => ({
    password: "",
    confirm: "",
    errors: [],
    lastPasswordChange
});

export class Password extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(props);
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        if (prevState.lastPasswordChange === nextProps.lastPasswordChange) {
            return null;
        }

        return getInitialState(nextProps);
    }

    componentWillUnmount() {
        this.setState(getInitialState(this.props));
    }

    handleChange = e => {
        const { name, value } = e.target;

        this.setState({
            [name]: value,
            errors: []
        });
    };

    handleClear = () => {
        this.setState({
            password: "",
            confirm: "",
            errors: []
        });
    };

    handleSetForceReset = () => {
        this.props.onSetForceReset(this.props.id, !this.props.forceReset);
    };

    handleSubmit = e => {
        e.preventDefault();

        const errors = [];

        if (!this.state.password || this.state.password.length < this.props.minimumPasswordLength) {
            errors.push({
                id: 0,
                message: `Passwords must contain at least ${this.props.minimumPasswordLength} characters`
            });
        }

        if (this.state.confirm !== this.state.password) {
            errors.push({
                id: 1,
                message: "Passwords do not match"
            });
        }

        if (errors.length) {
            this.setState({ errors });
            return;
        }

        this.props.onSubmit(this.props.id, this.state.password);
        this.handleClear();
    };

    render() {
        const passwordLengthError = find(this.state.errors, ["id", 0])
            ? find(this.state.errors, ["id", 0]).message
            : null;
        const passwordMatchError = find(this.state.errors, ["id", 1])
            ? find(this.state.errors, ["id", 1]).message
            : null;

        const { error, forceReset, lastPasswordChange } = this.props;

        return (
            <div>
                <label>Change Password</label>
                <Panel>
                    <Panel.Body>
                        <p>
                            <em>
                                Last changed <RelativeTime time={lastPasswordChange} em={true} />
                            </em>
                        </p>

                        <form onSubmit={this.handleSubmit}>
                            <Row>
                                <Col xs={12} md={6}>
                                    <InputError
                                        type="password"
                                        name="password"
                                        placeholder="New Password"
                                        value={this.state.password}
                                        onChange={this.handleChange}
                                        error={passwordLengthError}
                                    />
                                </Col>

                                <Col xs={12} md={6}>
                                    <InputError
                                        type="password"
                                        name="confirm"
                                        placeholder="Confirm Password"
                                        value={this.state.confirm}
                                        onChange={this.handleChange}
                                        error={passwordMatchError}
                                    />
                                </Col>
                            </Row>
                            <Row>
                                <Col xs={12} md={6}>
                                    <Checkbox
                                        label="Force user to reset password on next login"
                                        checked={forceReset}
                                        onClick={this.handleSetForceReset}
                                    />
                                </Col>

                                <Col xs={12} mdHidden lgHidden>
                                    <div style={{ height: "15px" }} />
                                </Col>

                                <Col xs={12} md={6}>
                                    <ButtonToolbar>
                                        <Button type="button" onClick={this.handleClear}>
                                            Clear
                                        </Button>

                                        <SaveButton />
                                    </ButtonToolbar>
                                </Col>

                                <Col xs={12} className={CX({ hidden: !this.state.error })}>
                                    <h5 className="text-danger">Passwords do not match</h5>
                                </Col>
                            </Row>
                        </form>

                        {error ? <DangerAlert>{error}</DangerAlert> : null}
                    </Panel.Body>
                </Panel>
            </div>
        );
    }
}

export const mapStateToProps = state => {
    const { force_reset, id, last_password_change } = state.users.detail;
    return {
        id,
        forceReset: force_reset,
        lastPasswordChange: last_password_change,
        minimumPasswordLength: state.settings.data.minimum_password_length,
        error: get(state, "errors.GET_USER_ERROR.message", "")
    };
};

export const mapDispatchToProps = dispatch => ({
    onSubmit: (userId, password) => {
        dispatch(editUser(userId, { password }));
    },

    onSetForceReset: (userId, enabled) => {
        dispatch(editUser(userId, { force_reset: enabled }));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(Password);
