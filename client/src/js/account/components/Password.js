import React from "react";
import { connect } from "react-redux";
import { Alert, Col, Panel, Row } from "react-bootstrap";

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
            this.setState({errors: ["Old password is invalid"]});
        }

        if (nextProps.lastPasswordChange !== this.props.lastPasswordChange) {
            this.setState(getInitialState());
        }
    }

    handleSubmit (e) {
        e.preventDefault();

        const errors = [];

        const minLength = this.props.settings.minimum_password_length;

        if (this.state.confirmPassword.length < minLength || this.state.newPassword.length < minLength) {
            errors.push(`Password must be contain least ${minLength} characters`);
        }

        if (this.state.confirmPassword !== this.state.newPassword) {
            errors.push("New passwords do not match");
        }

        if (errors.length) {
            return this.setState({errors});
        }

        // Set state to show that the user attempted to submit the form.
        this.props.onChangePassword(this.state.oldPassword, this.state.newPassword, this.state.confirmPassword);
    }

    render () {
        if (!this.props.settings) {
            return <div />;
        }

        let errorAlert;

        if (this.state.errors.length) {
            const errorComponents = this.state.errors.map(error =>
                <li key={error}>{error}</li>
            );

            errorAlert = (
                <Alert bsStyle="danger">
                    {errorComponents}
                </Alert>
            );
        }

        return (
            <Panel header="Password">
                <form onSubmit={this.handleSubmit}>
                    <Input
                        label="Old Password"
                        type="password"
                        value={this.state.oldPassword}
                        onChange={(e) => this.setState({oldPassword: e.target.value, errors: []})}
                    />
                    <Input
                        label="New password"
                        type="password"
                        value={this.state.newPassword}
                        onChange={(e) => this.setState({newPassword: e.target.value, errors: []})}
                    />
                    <Input
                        label="Confirm New Password"
                        type="password"
                        value={this.state.confirmPassword}
                        onChange={(e) => this.setState({confirmPassword: e.target.value, errors: []})}
                    />

                    {errorAlert}

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
