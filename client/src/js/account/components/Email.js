import React from "react";
import { map } from "lodash-es";
import { connect } from "react-redux";
import { Alert, Col, Panel, Row } from "react-bootstrap";

import { updateAccount } from "../actions";
import { Button, Input } from "../../base";

const getInitialState = (email) => ({
    defaultEmail: email ? email : "",
    tempEmail: email ? email : "",
    errors: []
});

const validateEmail = (email) => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
};

class Email extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState(this.props.email);
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
            defaultEmail: this.state.tempEmail
        });

        this.props.onUpdateEmail({
            email: this.state.tempEmail
        });
    };

    render () {

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
                        label="Email address"
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
    email: state.account.email
});

const mapDispatchToProps = (dispatch) => ({

    onUpdateEmail: (email) => {
        dispatch(updateAccount(email));
    }
});

const Container = connect(mapStateToProps, mapDispatchToProps)(Email);

export default Container;
