import { get } from "lodash-es";
import React from "react";
import { Col, Row } from "react-bootstrap";
import { connect } from "react-redux";
import { InputError, Panel, SaveButton } from "../../base";
import { clearError } from "../../errors/actions";
import { updateAccount } from "../actions";

const getInitialState = email => ({
    email: email || "",
    error: ""
});

const re = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;

export class Email extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(this.props.email);
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        if (nextProps.error === "Invalid input" && !prevState.error.length) {
            return { error: "Please provide a valid email address" };
        }
        return null;
    }

    handleChange = e => {
        this.setState({
            email: e.target.value,
            error: ""
        });

        if (this.props.error) {
            this.props.onClearError("UPDATE_ACCOUNT_ERROR");
        }
    };

    handleBlur = e => {
        if (!e.relatedTarget) {
            this.setState({
                email: this.props.email,
                error: ""
            });
        }
    };

    handleSubmit = e => {
        e.preventDefault();

        if (!re.test(this.state.email)) {
            this.setState({ error: "Please provide a valid email address" });
            return;
        }

        this.props.onUpdateEmail(this.state.email);
    };

    render() {
        return (
            <Row>
                <Col md={8} lg={6}>
                    <Panel bsStyle={this.state.error ? "danger" : "default"}>
                        <Panel.Heading>Email</Panel.Heading>
                        <Panel.Body>
                            <form onSubmit={this.handleSubmit}>
                                <InputError
                                    label="Email address"
                                    value={this.state.email}
                                    onChange={this.handleChange}
                                    onBlur={this.handleBlur}
                                    error={this.state.error}
                                />

                                <div style={{ marginTop: "20px" }}>
                                    <Row>
                                        <Col xs={24} md={12}>
                                            <SaveButton pullRight />
                                        </Col>
                                    </Row>
                                </div>
                            </form>
                        </Panel.Body>
                    </Panel>
                </Col>
            </Row>
        );
    }
}

const mapStateToProps = state => ({
    email: state.account.email,
    error: get(state, "errors.UPDATE_ACCOUNT_ERROR.message", "")
});

const mapDispatchToProps = dispatch => ({
    onUpdateEmail: email => {
        dispatch(updateAccount(email));
    },

    onClearError: error => {
        dispatch(clearError(error));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(Email);
