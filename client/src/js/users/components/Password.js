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
import { connect } from "react-redux";
import { Row, Col, Alert, Panel, ButtonToolbar } from "react-bootstrap";

import { setForceReset, setPassword } from "../../users/actions";
import { Icon, Input, Checkbox, Button, RelativeTime } from "../../base";

class Password extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            newPassword: "",
            confirmPassword: ""
        };
    }

    componentWillUnmount () {
        this.setState({
            newPassword: "",
            confirmPassword: ""
        });
    }

    handleSubmit = (event) => {
        event.preventDefault();
        this.props.onSubmit(this.props.id, this.props.newPassword);
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

                <form onSubmit={this.submit}>
                    <Row>
                        <Col xs={16} md={6}>
                            <Input
                                type="password"
                                name="password"
                                placeholder="New Password"
                                value={this.state.password}
                                onChange={(e) => this.setState({newPassword: e.target.value})}
                            />
                        </Col>

                        <Col xs={12} md={6}>
                            <Input
                                type="password"
                                name="confirm"
                                placeholder="Confirm Password"
                                value={this.state.confirm}
                                onChange={(e) => this.setState({oldPassword: e.target.value})}
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
                                    onClick={() => this.setState({oldPassword: "", newPassword: ""})}
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
                    </Row>
                </form>

                {alert}
            </Panel>
        );
    }
}

const mapDispatchToProps = (dispatch) => {
    return {
        onSubmit: (userId, password, confirm) => {
            dispatch(setPassword(userId, password, confirm));
        },

        onSetForceReset: (userId, enabled) => {
            dispatch(setForceReset(userId, enabled));
        }
    };
};

const Container = connect(() => ({}), mapDispatchToProps)(Password);

export default Container;
