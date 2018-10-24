import React from "react";
import { filter, map, get } from "lodash-es";
import { Row, Col, ListGroup, Modal } from "react-bootstrap";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { push } from "react-router-redux";

import { listFiles } from "../../files/actions";
import { createSubtraction } from "../actions";
import { clearError } from "../../errors/actions";
import {
  Button,
  Icon,
  InputError,
  ListGroupItem,
  RelativeTime
} from "../../base";
import { routerLocationHasState, getTargetChange } from "../../utils";

export class SubtractionFileItem extends React.Component {
  handleClick = () => {
    this.props.onClick(this.props.id);
  };

  render() {
    const { active, name, uploaded_at, user } = this.props;

    return (
      <ListGroupItem active={active} onClick={this.handleClick}>
        <Row>
          <Col xs={7}>
            <strong>{name}</strong>
          </Col>
          <Col xs={5}>
            Uploaded <RelativeTime time={uploaded_at} /> by {user.id}
          </Col>
        </Row>
      </ListGroupItem>
    );
  }
}

const getInitialState = () => ({
  subtractionId: "",
  fileId: "",
  nickname: "",
  errorSubtractionId: "",
  errorFile: ""
});

export class CreateSubtraction extends React.Component {
  constructor(props) {
    super(props);
    this.state = getInitialState();
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    if (!prevState.errorSubtractionId && nextProps.error) {
      return { errorSubtractionId: nextProps.error };
    }
    return null;
  }

  handleChange = e => {
    const { name, value, error } = getTargetChange(e.target);

    this.setState({ [name]: value, [error]: "" });

    if (this.props.error) {
      this.props.onClearError("CREATE_SUBTRACTION_ERROR");
    }
  };

  handleModalEnter = () => {
    this.props.onListFiles();
  };

  handleModalExited = () => {
    this.setState(getInitialState());
    if (this.props.error) {
      this.props.onClearError("CREATE_SUBTRACTION_ERROR");
    }
  };

  handleSelectFile = fileId => {
    this.setState({
      fileId: fileId === this.state.fileId ? "" : fileId,
      errorFile: ""
    });
  };

  handleSubmit = e => {
    e.preventDefault();

    let hasError = false;

    if (!this.state.subtractionId) {
      hasError = true;
      this.setState({ errorSubtractionId: "Required Field" });
    }

    if (!this.state.fileId) {
      hasError = true;
      this.setState({ errorFile: "Please select a file" });
    }

    if (!hasError) {
      this.props.onCreate(this.state);
    }
  };

  render() {
    const files = filter(this.props.files, { type: "subtraction" });

    let fileComponents;

    if (files.length) {
      fileComponents = map(files, file => (
        <SubtractionFileItem
          key={file.id}
          {...file}
          active={file.id === this.state.fileId}
          onClick={this.handleSelectFile}
        />
      ));
    } else {
      fileComponents = (
        <ListGroupItem className="text-center">
          <Icon name="info-circle" /> No files found.{" "}
          <Link to="/subtraction/files">Upload some</Link>.
        </ListGroupItem>
      );
    }

    const panelListStyle = this.state.errorFile
      ? "panel-list-custom-error"
      : "panel-list-custom";
    const inputErrorClassName = this.state.errorFile
      ? "input-form-error"
      : "input-form-error-none";

    const errorMessage = (
      <div className={inputErrorClassName} style={{ margin: "3px 0 0 0" }}>
        {this.state.errorFile || "None"}
      </div>
    );

    return (
      <Modal
        bsSize="large"
        show={this.props.show}
        onHide={this.props.onHide}
        onEnter={this.handleModalEnter}
        onExited={this.handleModalExited}
      >
        <Modal.Header>Create Subtraction</Modal.Header>

        <form onSubmit={this.handleSubmit}>
          <Modal.Body style={{ margin: "0 0 10px 0" }}>
            <Row>
              <Col md={12}>
                <InputError
                  type="text"
                  label="Unique Name"
                  name="subtractionId"
                  value={this.state.subtractionId}
                  onChange={this.handleChange}
                  error={this.state.errorSubtractionId}
                />
              </Col>
            </Row>
            <Row>
              <Col md={12}>
                <InputError
                  type="text"
                  label="Nickname"
                  name="nickname"
                  value={this.state.nickname}
                  onChange={this.handleChange}
                />
              </Col>
            </Row>

            <h5>
              <strong>Files</strong>
            </h5>
            <ListGroup className={panelListStyle}>{fileComponents}</ListGroup>
            {errorMessage}
          </Modal.Body>

          <Modal.Footer className="modal-footer">
            <Button type="submit" bsStyle="primary" icon="play" pullRight>
              Start
            </Button>
          </Modal.Footer>
        </form>
      </Modal>
    );
  }
}

const mapStateToProps = state => ({
  show: routerLocationHasState(state, "createSubtraction"),
  files: state.files.documents,
  error: get(state, "errors.CREATE_SUBTRACTION_ERROR.message", "")
});

const mapDispatchToProps = dispatch => ({
  onCreate: ({ subtractionId, fileId, nickname }) => {
    dispatch(createSubtraction(subtractionId, fileId, nickname));
  },

  onListFiles: () => {
    dispatch(listFiles("subtraction"));
  },

  onHide: () => {
    dispatch(push({ ...window.location, state: { createSubtraction: false } }));
  },

  onClearError: error => {
    dispatch(clearError(error));
  }
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(CreateSubtraction);
