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

const getInitialState = () => ({
    password: "",
    confirm: "",
    error: false
});

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
        this.setState(getInitialState());
    }

    handleChange = (e, key) => {
        const state = {
            error: this.state.error && this.state.password === this.state.confirm
        };

        state[key] = e.target.value;

        this.setState(state);
    };

    handleSubmit = (e) => {
        e.preventDefault();

        if (this.state.password === this.state.confirm) {
            this.props.onSubmit(this.props.id, this.state.password);
        } else {
            this.setState({error: true});
        }
    };

    render = () => (
        <Panel>
            <p>
                <em>
                    Last changed <RelativeTime time={this.props.last_password_change} em={true}/>
                </em>
            </p>

            <form onSubmit={this.handleSubmit}>
                <Row>
                    <Col xs={12} md={6}>
                        <Input
                            type="password"
                            placeholder="New Password"
                            value={this.state.password}
                            onChange={(e) => this.handleChange(e, "password")}
                        />
                    </Col>

                    <Col xs={12} md={6}>
                        <Input
                            type="password"
                            placeholder="Confirm Password"
                            value={this.state.confirm}
                            onChange={(e) => this.handleChange(e, "confirm")}
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
                                onClick={() => this.setState({confirm: "", pass: ""})}
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

                    <Col xs={12} className={CX({hidden: !this.state.error})}>
                        <h5 className="text-danger">
                            Passwords do not match
                        </h5>
                    </Col>
                </Row>
            </form>

            {this.props.error ? (
                <Alert bsStyle="danger">
                    {this.props.error}
                </Alert>
            ) : null}

        </Panel>
    );
}

const mapDispatchToProps = (dispatch) => ({

    onSubmit: (userId, password) => {
        dispatch(setPassword(userId, password));
    },

    onSetForceReset: (userId, enabled) => {
        dispatch(setForceReset(userId, enabled));
    }

});

const Container = connect(() => ({}), mapDispatchToProps)(Password);

export default Container;
