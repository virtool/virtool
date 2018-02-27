import React from "react";
import { connect } from "react-redux";
import { Col, Panel, Row } from "react-bootstrap";

import { updateAccount } from "../actions";
import { Button, Input } from "../../base";

const getInitialState = (email) => ({
    defaultEmail: email ? email : "",
    tempEmail: email ? email : "",
    error: ""
});

const validateEmail = (email) => {
    const re = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
    return re.test(email);
};

class Email extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState(this.props.email);
    }

    onSubmit = (e) => {
        e.preventDefault();

        let error = "";

        const checkEmail = validateEmail(this.state.tempEmail);

        if (!checkEmail) {
            error = "Please provide a valid email address";
        }

        if (error) {
            return this.setState({error});
        }

        this.setState({
            defaultEmail: this.state.tempEmail
        });

        this.props.onUpdateEmail({
            email: this.state.tempEmail
        });
    };

    render () {

        return (
            <Panel header="Email">
                <form onSubmit={this.onSubmit}>
                    <Input
                        label="Email address"
                        value={this.state.tempEmail}
                        onChange={(e) => this.setState({tempEmail: e.target.value, errors: []})}
                        error={this.state.error}
                    />

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
