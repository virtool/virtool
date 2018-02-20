import React from "react";
import { map } from "lodash-es";
import { connect } from "react-redux";
import { Alert, Col, Panel, Row } from "react-bootstrap";

import { changePassword } from "../actions";
import { Button, Input } from "../../base";

const getInitialState = () => ({
    defaultEmail: "",
    tempEmail: "",
    errors: []
});

const validateEmail = (email) => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
};

class Email extends React.Component {

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

    onSubmit = (e) => {
        e.preventDefault();

        const errors = [];

        const checkEmail = validateEmail(this.state.tempEmail);

        if (!checkEmail) {
            errors.push("Invalid email");
        }

        if (errors.length) {
            return this.setState({errors});
        }

        this.setState({
            defaultEmail: this.state.tempEmail,
            tempEmail: ""
        });
    };

    render () {

        if (!this.props.settings) {
            return <div />;
        }

        let errorAlert;

        if (this.state.errors.length) {
            const errorComponents = map(this.state.errors, error =>
                <li key={error}>
                    {error}
                </li>
            );

            errorAlert = (
                <Alert bsStyle="danger">
                    {errorComponents}
                </Alert>
            );
        }

        return (
            <Panel header="Email">
                <form onSubmit={this.onSubmit}>
                    <Input
                        label="Primary email address"
                        value={this.state.defaultEmail}
                        readOnly={true}
                    />
                    <Input
                        label="Change email address"
                        value={this.state.tempEmail}
                        onChange={(e) => this.setState({tempEmail: e.target.value, errors: []})}
                    />

                    {errorAlert}

                    <div style={{marginTop: "20px"}}>
                        <Row>
                            <Col xs={24} md={12}>
                                <Button type="submit" bsStyle="primary" icon="floppy" pullRight>
                                    Save
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
    settings: state.settings.data
});

const mapDispatchToProps = (dispatch) => ({

    onChangePassword: (oldPassword, newPassword) => {
        dispatch(changePassword(oldPassword, newPassword));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(Email);

export default Container;
