import React from "react";
import PropTypes from "prop-types";
import { includes } from "lodash-es";
import { Row, Col } from "react-bootstrap";
import { ListGroupItem } from "../../../base";
import { getTaskDisplayName } from "../../../utils";
import TaskField from "./TaskField";

const getInitialState = () => ({
  exceedsError: false,
  zeroError: false
});

export default class Task extends React.Component {
  constructor(props) {
    super(props);
    this.state = getInitialState();
  }

  componentDidUpdate(prevProps, prevState) {
    const { proc, mem, inst } = prevProps;

    if (
      proc === this.props.proc &&
      mem === this.props.mem &&
      inst === this.props.inst
    ) {
      if (prevState.exceedsError || prevState.zeroError) {
        this.handleClearError();
      }
    }
  }

  handleChangeLimit = (name, value) => {
    this.handleClearError();
    this.props.onChangeLimit(this.props.taskPrefix, name, value);
  };

  handleClearError = () => {
    this.setState(getInitialState());
  };

  handleInvalid = e => {
    const zeroError = e.target.value === "0";

    this.setState({
      exceedsError: !zeroError,
      zeroError
    });
  };

  render() {
    const {
      inst,
      mem,
      proc,
      taskPrefix,
      minProc,
      minMem,
      resourceProc,
      resourceMem,
      readOnlyFields
    } = this.props;

    const readOnly = includes(readOnlyFields, taskPrefix);

    let error;

    if (this.state.zeroError) {
      error = "Value cannot be 0";
    }

    if (this.state.exceedsError) {
      error = "Value cannot exceed system resource limits";
    }

    const errorComponent = (
      <div className={error ? "input-form-error" : "input-form-error-none"}>
        <span className="input-error-message">{error || "None"}</span>
      </div>
    );

    return (
      <ListGroupItem allowFocus>
        <h5>
          <strong>{getTaskDisplayName(taskPrefix)}</strong>
        </h5>
        <Row>
          <Col md={4}>
            <TaskField
              name="proc"
              value={proc}
              readOnly={readOnly}
              onChange={this.handleChangeLimit}
              clear={this.handleClearError}
              lowerLimit={minProc}
              upperLimit={resourceProc}
              onInvalid={this.handleInvalid}
            />
          </Col>
          <Col md={4}>
            <TaskField
              name="mem"
              value={mem}
              readOnly={readOnly}
              onChange={this.handleChangeLimit}
              clear={this.handleClearError}
              lowerLimit={minMem}
              upperLimit={resourceMem}
              onInvalid={this.handleInvalid}
            />
          </Col>
          <Col md={4}>
            <TaskField
              name="inst"
              value={inst}
              readOnly={taskPrefix === "rebuild_index"}
              onChange={this.handleChangeLimit}
              clear={this.handleClearError}
              lowerLimit={1}
              upperLimit={10}
              onInvalid={this.handleInvalid}
            />
          </Col>

          {errorComponent}
        </Row>
      </ListGroupItem>
    );
  }
}

Task.propTypes = {
  taskPrefix: PropTypes.string.isRequired,
  proc: PropTypes.number,
  mem: PropTypes.number,
  inst: PropTypes.number,
  onChangeLimit: PropTypes.func,
  minProc: PropTypes.number,
  minMem: PropTypes.number,
  resourceProc: PropTypes.number,
  resourceMem: PropTypes.number,
  readOnlyFields: PropTypes.array
};
