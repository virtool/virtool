import React from "react";
import { get, pick } from "lodash-es";
import { push } from "react-router-redux";
import { connect } from "react-redux";
import { Row, Col, Modal } from "react-bootstrap";

import { editSample } from "../actions";
import { clearError } from "../../errors/actions";
import { SaveButton, InputError } from "../../base";

const getInitialState = ({ name, isolate, host, locale }) => ({
  name: name || "",
  isolate: isolate || "",
  host: host || "",
  locale: locale || "",
  error: ""
});

class EditSample extends React.Component {
  constructor(props) {
    super(props);
    this.state = getInitialState(this.props);
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    if (prevState.error !== nextProps.error) {
      return { error: nextProps.error };
    }
    return null;
  }

  handleChange = e => {
    const { name, value } = e.target;
    this.setState({
      [name]: value,
      error: ""
    });

    if (this.props.error) {
      this.props.onClearError("UPDATE_SAMPLE_ERROR");
    }
  };

  handleModalEnter = () => {
    this.setState(getInitialState(this.props));
  };

  handleModalHide = () => {
    if (this.props.error) {
      this.props.onClearError("UPDATE_SAMPLE_ERROR");
    }
    this.props.onHide();
  };

  handleSubmit = e => {
    e.preventDefault();

    if (!this.state.name) {
      return this.setState({
        error: "Required Field"
      });
    }

    this.props.onEdit(
      this.props.id,
      pick(this.state, ["name", "isolate", "host", "locale"])
    );
  };

  render() {
    return (
      <Modal
        show={this.props.show}
        onEnter={this.handleModalEnter}
        onHide={this.handleModalHide}
      >
        <Modal.Header onHide={this.props.onHide} closeButton>
          Edit Sample
        </Modal.Header>
        <form onSubmit={this.handleSubmit}>
          <Modal.Body>
            <Row>
              <Col xs={12}>
                <InputError
                  label="Name"
                  name="name"
                  value={this.state.name}
                  onChange={this.handleChange}
                  error={this.state.error}
                />
              </Col>
            </Row>

            <Row>
              <Col xs={12} md={6}>
                <InputError
                  label="Isolate"
                  name="isolate"
                  value={this.state.isolate}
                  onChange={this.handleChange}
                />
              </Col>
              <Col xs={12} md={6}>
                <InputError
                  label="Host"
                  name="host"
                  value={this.state.host}
                  onChange={this.handleChange}
                />
              </Col>
            </Row>

            <Row>
              <Col xs={12} md={6}>
                <InputError
                  name="locale"
                  label="Locale"
                  value={this.state.locale}
                  onChange={this.handleChange}
                />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <SaveButton />
          </Modal.Footer>
        </form>
      </Modal>
    );
  }
}

const mapStateToProps = state => ({
  ...state.samples.detail,
  show: get(state.router.location.state, "editSample", false),
  error: get(state, "errors.UPDATE_SAMPLE_ERROR.message", "")
});

const mapDispatchToProps = dispatch => ({
  onHide: () => {
    dispatch(push({ state: { showEdit: false } }));
  },

  onEdit: (sampleId, update) => {
    dispatch(editSample(sampleId, update));
  },

  onClearError: error => {
    dispatch(clearError(error));
  }
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(EditSample);
