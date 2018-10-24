import React from "react";
import PropTypes from "prop-types";
import { Row, Col } from "react-bootstrap";
import { connect } from "react-redux";
import { map } from "lodash-es";
import { InputError, Checkbox } from "../../../base";

class SegmentForm extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isChecked: true,
      showError: this.props.newEntry.showError,
      error: ""
    };
  }

  static getDerivedStateFromProps(nextProps) {
    if (nextProps.errors && nextProps.errors.EDIT_OTU_ERROR) {
      return { error: nextProps.errors.EDIT_OTU_ERROR.message };
    }

    let error = "";
    error = nextProps.newEntry.showError ? "Required Field" : "";
    error = nextProps.newEntry.nameTaken
      ? "Segment names must be unique. This name is currently in use."
      : error;

    return {
      isChecked: nextProps.newEntry.required,
      showError: nextProps.newEntry.showError,
      error
    };
  }

  changeSegName = e => {
    this.props.onChange({
      ...this.props.newEntry,
      name: e.target.value
    });
    this.setState({ error: "" });
  };

  changeMolType = e => {
    this.props.onChange({
      ...this.props.newEntry,
      molecule: e.target.value
    });
    this.setState({ error: "" });
  };

  toggleCheck = () => {
    this.props.onChange({
      ...this.props.newEntry,
      required: !this.state.isChecked
    });
    this.setState({ isChecked: !this.state.isChecked, error: "" });
  };

  render() {
    const moleculeTypes = [
      "",
      "ssDNA",
      "dsDNA",
      "ssRNA+",
      "ssRNA-",
      "ssRNA",
      "dsRNA"
    ];

    const molecules = map(moleculeTypes, molecule => (
      <option key={molecule} value={molecule}>
        {molecule || "None"}
      </option>
    ));

    return (
      <div>
        <Row>
          <Col md={9}>
            <InputError
              label="Name"
              value={this.props.newEntry.name}
              onChange={this.changeSegName}
              error={this.state.error}
            />
          </Col>
          <Col md={3}>
            <InputError
              type="select"
              label="Molecule Type"
              value={this.props.newEntry.molecule}
              onChange={this.changeMolType}
            >
              {molecules}
            </InputError>
          </Col>
        </Row>
        <Row>
          <Col md={12}>
            <Checkbox
              label="Segment Required"
              checked={this.state.isChecked}
              onClick={this.toggleCheck}
              pullLeft
            />
          </Col>
        </Row>
      </div>
    );
  }
}

SegmentForm.propTypes = {
  onChange: PropTypes.func.isRequired,
  newEntry: PropTypes.object.isRequired,
  errors: PropTypes.object
};

const mapStateToProps = state => ({
  errors: state.errors
});

export default connect(
  mapStateToProps,
  null
)(SegmentForm);
