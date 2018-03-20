import React from "react";
import { get } from "lodash-es";
import { connect } from "react-redux";
import { Col, Panel, Row } from "react-bootstrap";

import { updateAccount } from "../actions";
import { Button, InputError } from "../../base";

const getInitialState = (email) => ({
    email: email || "",
    error: ""
});

const re = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;

class Email extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState(this.props.email);
    }

    componentWillReceiveProps (nextProps) {
        if (!this.props.error && nextProps.error === "Invalid input") {
            this.setState({ error: "Please provide a valid email address" });
        }
    }

    onSubmit = (e) => {
        e.preventDefault();

        let error = "";

        if (!re.test(this.state.tempEmail)) {
            error = "Please provide a valid email address";
        }

        if (error) {
            return this.setState({error});
        }

        this.props.onUpdateEmail({
            email: this.state.email
        });
    };

    render () {

        const formStyle = this.state.error ? "panel-danger" : "panel-default";

        return (
            <Panel className={formStyle} header="Email">
                <form onSubmit={this.onSubmit}>
                    <InputError
                        label="Email address"
                        value={this.state.tempEmail}
                        onChange={(e) => this.setState({tempEmail: e.target.value, error: ""})}
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
    email: state.account.email,
    error: get(state, "errors.UPDATE_ACCOUNT_ERROR.message", "")
});

const mapDispatchToProps = (dispatch) => ({

    onUpdateEmail: (email) => {
        dispatch(updateAccount(email));
    }
});

const Container = connect(mapStateToProps, mapDispatchToProps)(Email);

export default Container;
