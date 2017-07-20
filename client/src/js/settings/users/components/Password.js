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
import { find } from "lodash";
import { connect } from "react-redux";
import { Alert, Panel } from "react-bootstrap";

import { setForceReset, changeSetPassword, changeSetConfirm, setPassword, clearSetPassword } from "../../users/actions";
import { FlexItem, Icon, Input, Checkbox, Button, RelativeTime } from "virtool/js/components/Base";

class Password extends React.PureComponent {

    static propTypes = {
        userId: React.PropTypes.string,

        password: React.PropTypes.string,
        confirm: React.PropTypes.string,
        error: React.PropTypes.string,
        lastPasswordChange: React.PropTypes.string,
        passwordChangePending: React.PropTypes.bool,
        onChangePassword: React.PropTypes.func,
        onChangeConfirm: React.PropTypes.func,
        onSubmit: React.PropTypes.func,
        onClear: React.PropTypes.func,

        forceReset: React.PropTypes.bool,
        onSetForceReset: React.PropTypes.func
    };

    /**
     * Called when the password is submitted. Sends the new password data to the server.
     *
     * @param e - the submit event, used purely to prevent the default submit action
     */
    submit = (e) => {
        e.preventDefault();
        this.props.onSubmit(this.props.userId, this.props.password, this.props.confirm);
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
            <div>
                <h5><Icon name="lock" /> <strong>Password</strong></h5>

                <Panel>
                    <p>
                        <em>Last changed </em>
                        <RelativeTime time={this.props.lastPasswordChange} em={true} />
                    </p>

                    <form onSubmit={this.submit}>
                        <div className="toolbar">
                            <FlexItem grow={1}>
                                <Input
                                    type="password"
                                    name="password"
                                    placeholder="New Password"
                                    value={this.props.password}
                                    onChange={(e) => {this.props.onChangePassword(e.target.value)}}
                                    disabled={this.props.passwordChangePending}
                                />
                            </FlexItem>

                            <FlexItem grow={1}>
                                <Input
                                    type="password"
                                    name="confirm"
                                    placeholder="Confirm Password"
                                    value={this.props.confirm}
                                    onChange={(e) => {this.props.onChangeConfirm(e.target.value)}}
                                    disabled={this.props.passwordChangePending}
                                />
                            </FlexItem>

                            <Button
                                type="button"
                                onClick={this.props.onClear}
                                disabled={this.props.passwordChangePending}
                            >
                                Clear
                            </Button>

                            <Button
                                icon="floppy"
                                type="submit"
                                bsStyle="primary"
                                disabled={this.props.passwordChangePending}
                            >
                                Save
                            </Button>
                        </div>
                    </form>

                    {alert}

                    <div className="panel-section">
                        <Checkbox
                            label="Force user to reset password on next login"
                            checked={this.props.forceReset}
                            onClick={() => {this.props.onSetForceReset(this.props.userId, !this.props.forceReset)}}
                        />
                    </div>
                </Panel>
            </div>

        );
    }
}

const mapStateToProps = (state) => {

    const activeData = find(state.users.list, {user_id: state.users.activeId});

    return {
        userId: state.users.activeId,

        password: state.users.password,
        confirm: state.users.confirm,
        error: state.users.passwordError,
        passwordChangePending: state.users.passwordChangePending,

        lastPasswordChange: activeData.last_password_change,
        forceReset: activeData.force_reset
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onClear: () => {
            dispatch(clearSetPassword())
        },

        onChangePassword: (password) => {
            dispatch(changeSetPassword(password));
        },

        onChangeConfirm: (confirm) => {
            dispatch(changeSetConfirm(confirm));
        },

        onSubmit: (userId, password, confirm) => {
            dispatch(setPassword(userId, password, confirm));
        },

        onSetForceReset: (userId, enabled) => {
            dispatch(setForceReset(userId, enabled));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(Password);

export default Container;
