import React from "react";
import { get } from "lodash-es";
import { connect } from "react-redux";
import { Col, Panel, Row } from "react-bootstrap";

import { updateAccount } from "../actions";
import { clearError } from "../../errors/actions";
import { SaveButton, InputError } from "../../base";

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

  onSubmit = e => {
    e.preventDefault();

    if (!re.test(this.state.email)) {
      const error = "Please provide a valid email address";
      return this.setState({ error });
    }

    this.props.onUpdateEmail({
      email: this.state.email
    });
  };

  render() {
    return (
      <Row>
        <Col md={8} lg={6}>
          <Panel bsStyle={this.state.error ? "danger" : "default"}>
            <Panel.Heading>Email</Panel.Heading>
            <Panel.Body>
              <form onSubmit={this.onSubmit}>
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
