import React from "react";
import { find } from "lodash-es";
import { connect } from "react-redux";
import { Col, Panel, Row } from "react-bootstrap";

import { changePassword } from "../actions";
import { Button, Input, RelativeTime } from "../../base";

const getInitialState = () => ({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
    errors: []
});

class ChangePassword extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    componentWillReceiveProps (nextProps) {
        if (nextProps.oldPasswordError) {
            this.setState({
                errors: [
                    {
                        id: 0,
                        message: "Old password is invalid"
                    }
                ]
            });
        }

        if (nextProps.lastPasswordChange !== this.props.lastPasswordChange) {
            this.setState(getInitialState());
        }
    }

    onSubmit = (e) => {
        e.preventDefault();

        const errors = [];

        const minLength = this.props.settings.minimum_password_length;

        if (!this.state.oldPassword.length) {
            errors.push({
                id: 0,
                message: "Please provide your old password"
            });
        }

        if (this.state.newPassword.length < minLength) {
            errors.push({
                id: 1,
                message: `Passwords must contain at least ${minLength} characters`
            });
        }

        if (this.state.confirmPassword !== this.state.newPassword) {
            errors.push({
                id: 2,
                message: "New passwords do not match"
            });
        }

        if (errors.length) {
            return this.setState({errors});
        }

        // Set state to show that the user attempted to submit the form.
        this.props.onChangePassword(this.state.oldPassword, this.state.newPassword, this.state.confirmPassword);
    };

    render () {

        if (!this.props.settings) {
            return <div />;
        }

        const errorOldPass = find(this.state.errors, ["id", 0]) ? find(this.state.errors, ["id", 0]).message : null;
        const errorPassLen = find(this.state.errors, ["id", 1]) ? find(this.state.errors, ["id", 1]).message : null;
        const errorPassMatch = find(this.state.errors, ["id", 2]) ? find(this.state.errors, ["id", 2]).message : null;

        const formStyle = this.state.errors.length ? "panel-danger" : "panel-default";

        return (
            <Panel className={formStyle} header="Password">
                <form onSubmit={this.onSubmit}>
                    <Input
                        label="Old Password"
                        type="password"
                        value={this.state.oldPassword}
                        onChange={(e) => this.setState({oldPassword: e.target.value, errors: []})}
                        error={errorOldPass}
                    />
                    <Input
                        label="New password"
                        type="password"
                        value={this.state.newPassword}
                        onChange={(e) => this.setState({newPassword: e.target.value, errors: []})}
                        error={errorPassLen}
                    />
                    <Input
                        label="Confirm New Password"
                        type="password"
                        value={this.state.confirmPassword}
                        onChange={(e) => this.setState({confirmPassword: e.target.value, errors: []})}
                        error={errorPassMatch}
                    />

                    <div style={{marginTop: "20px"}}>
                        <Row>
                            <Col xs={12} md={6} className="text-muted">
                                Last changed <RelativeTime time={this.props.lastPasswordChange} />
                            </Col>
                            <Col xs={12} md={6}>
                                <Button type="submit" bsStyle="primary" icon="floppy" pullRight>
                                    Change
                                </Button>
                            </Col>
                        </Row>
                    </div>
                </form>
            </Panel>
        );
    }
}

const mapStateToProps = (state) => ({
    lastPasswordChange: state.account.last_password_change,
    oldPasswordError: state.account.oldPasswordError,
    settings: state.settings.data
});

const mapDispatchToProps = (dispatch) => ({

    onChangePassword: (oldPassword, newPassword) => {
        dispatch(changePassword(oldPassword, newPassword));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(ChangePassword);

export default Container;
