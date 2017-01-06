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
import { Alert, Panel } from "react-bootstrap";
import { Flex, FlexItem, Icon, Input, Checkbox, Button, RelativeTime } from "virtool/js/components/Base";

const getChangeState = () => ({
    password: "",
    confirm: "",
    failed: false,
    pendingChange: false
});

/**
 * The password change form subcomponent of the component exported by the module.
 */
class Change extends React.PureComponent {

    constructor (props) {
        super(props);
        this.state = getChangeState();
    }

    static propTypes = {
        _id: React.PropTypes.string,
        last_password_change: React.PropTypes.string
    };

    handleChange = (event) => {
        let data = {};
        data[event.target.name] = event.target.value;
        this.setState(data);
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

    clear = () => this.setState(getChangeState());

    render () {

        let alert;

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

        return (
            <div>
                <p>
                    <em>Last changed </em>
                    <RelativeTime time={this.props.last_password_change} em={true} />
                </p>
                <form onSubmit={this.submit}>
                    <Flex>
                        <FlexItem grow={1}>
                            <Input
                                type="password"
                                name="password"
                                placeholder="New Password"
                                value={this.state.password}
                                onChange={this.handleChange}
                                disabled={this.state.pendingChange}
                            />
                        </FlexItem>

                        <FlexItem grow={1} pad>
                            <Input
                                type="password"
                                name="confirm"
                                placeholder="Confirm Password"
                                value={this.state.confirm}
                                onChange={this.handleChange}
                                disabled={this.state.pendingChange}
                            />
                        </FlexItem>

                        <FlexItem pad>
                            <Button onClick={this.clear} disabled={this.state.pendingChange}>
                                Clear
                            </Button>
                        </FlexItem>

                        <FlexItem pad>
                            <Button type="submit" bsStyle="primary" disabled={submitDisabled}>
                                <Icon name="floppy" pending={this.state.pendingChange} /> Save
                            </Button>
                        </FlexItem>
                    </Flex>
                </form>
                {alert}
            </div>
        );
    }
}

/**
 * An subcomponent of the password change form that allows the force reset status of the user to be toggled. Consists
 * only of a label checkbox.
 */
class Reset extends React.PureComponent {

    static propTypes = {
        _id: React.PropTypes.string,
        forceReset: React.PropTypes.bool
    };

    toggle = () => {
        dispatcher.db.users.request("set_force_reset", {
            _id: this.props._id,
            force_reset: !this.props.forceReset
        });
    };

    render = () => (
        <div className="panel-section">
            <Checkbox checked={this.props.forceReset} onClick={this.toggle} />
            <span> Force user to reset password on next login.</span>
        </div>
    );

}

/**
 * A parent component to wrap the password change form and reset checkbox with a headed panel.
 */
const AdminChangePassword = (props) => (
    <div>
        <h5><Icon name="lock" /> <strong>Password</strong></h5>

        <Panel>
            <Change {...props} />
            <Reset _id={props._id} forceReset={props.force_reset} />
        </Panel>
    </div>
);

AdminChangePassword.propTypes = {
    _id: React.PropTypes.string,
    force_reset: React.PropTypes.bool
};

export default AdminChangePassword;
