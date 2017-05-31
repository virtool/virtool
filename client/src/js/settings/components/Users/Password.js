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
import { Alert, Panel } from "react-bootstrap";

import { setForceReset, clearSetPassword } from "../../users/actions";
import { FlexItem, Icon, Input, Checkbox, Button, RelativeTime } from "virtool/js/components/Base";

class Password extends React.PureComponent {

    static propTypes = {
        userId: React.PropTypes.string,

        password: React.PropTypes.string,
        confirm: React.PropTypes.string,
        lastPasswordChange: React.PropTypes.string,
        passwordChangePending: React.PropTypes.bool,
        onChangePassword: React.PropTypes.func,
        onChangeConfirm: React.PropTypes.func,

        forceReset: React.PropTypes.bool,
        onSetForceReset: React.PropTypes.func
    };

    isMatch = () => this.state.password === this.state.confirm;
    isLong = () => this.state.password.length >= 4;

    /**
     * Called when the password is submitted. Sends the new password data to the server.
     *
     * @param event - the submit event, used purely to prevent the default submit action
     */
    submit = (event) => {
        event.preventDefault();

        if (this.isMatch() && this.isLong()) {
            this.setState({pendingChange: true} , () => {
                dispatcher.db.users.request("set_password", {_id: this.props._id, new_password: this.state.password})
                    .success(() => {
                        this.setState(getChangeState());
                    });
            });
        } else {
            this.setState({failed: true});
        }
    };

    render () {

        let alert;

        /*

        const match = this.isMatch();
        const long = this.isLong();

        // Show and alert with warnings if the password failed the pre-request checks.
        if (!(match && long) && this.state.failed) {
            alert = (
                <Alert bsStyle="danger" className="">
                    {long ? null: <li>passwords are not at least 4 characters long</li>}
                    {match ? null: <li>passwords don"t match</li>}
                </Alert>
            );
        }

        // Boolean to set whether the submit button is disabled or not.
        const submitDisabled = (!(match && long) && this.state.failed) || this.state.pendingChange;

        */

        const submitDisabled = this.props.passwordChangePending;

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
                                    onChange={this.props.onChangePassword}
                                    disabled={this.props.passwordChangePending}
                                />
                            </FlexItem>

                            <FlexItem grow={1}>
                                <Input
                                    type="password"
                                    name="confirm"
                                    placeholder="Confirm Password"
                                    value={this.props.confirm}
                                    onChange={this.props.onChangeSet}
                                    disabled={this.props.passwordChangePending}
                                />
                            </FlexItem>

                            <Button onClick={this.props.clear} disabled={this.props.passwordChangePending}>
                                Clear
                            </Button>

                            <Button type="submit" bsStyle="primary" disabled={submitDisabled}>
                                <Icon name="floppy" pending={this.props.passwordChangePending} /> Save
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
    return {
        userId: state.users.activeId,

        password: state.users.password,
        confirm: state.users.confirm,
        passwordChangePending: state.users.passwordChangePending,
        lastPasswordChange: state.users.activeData.last_password_change,

        forceReset: state.users.activeData.force_reset
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onClear: () => {
            dispatch(clearSetPassword())
        },

        onChangeSetPassword: (password, confirm) => {
            dispatch(changeSetPassword(password, confirm));
        },

        onSetForceReset: (userId, enabled) => {
            dispatch(setForceReset(userId, enabled));
        }
    }
};

const Container = connect(mapStateToProps, mapDispatchToProps)(Password);

export default Container;
