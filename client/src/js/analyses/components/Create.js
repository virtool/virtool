import React from "react";
import PropTypes from "prop-types";
import { map, find, reject } from "lodash-es";
import { Modal, ListGroup, Col, Label } from "react-bootstrap";
import {
  AlgorithmSelect,
  Button,
  ListGroupItem,
  NoneFound,
  Checkbox
} from "../../base/index";
import { getTaskDisplayName } from "../../utils";

export const IndexSelect = ({ indexes, onSelect, selected, error }) => {
  const errorStyle = error.length
    ? { border: "1px solid #d44b40" }
    : { border: "1px solid transparent" };

  return (
    <div style={{ marginBottom: "16px" }}>
      <label className="control-label">References</label>
      {indexes.length ? (
        <div>
          <ListGroup
            style={{
              maxHeight: "165px",
              overflowY: "auto",
              marginBottom: "3px",
              ...errorStyle
            }}
          >
            {map(indexes, index => (
              <ListGroupItem
                key={index.id}
                onClick={() =>
                  onSelect({ id: index.id, refId: index.reference.id })
                }
              >
                <Col xs={1}>
                  <Checkbox checked={!!find(selected, ["id", index.id])} />
                </Col>
                <Col xs={8}>
                  <strong>{index.reference.name}</strong>
                </Col>
                <Col xs={3}>
                  Index Version <Label>{index.version}</Label>
                </Col>
              </ListGroupItem>
            ))}
          </ListGroup>
          <Col xs={12}>
            <div className="input-form-error">
              <span className="input-error-message">{error}</span>
            </div>
          </Col>
        </div>
      ) : (
        <NoneFound noun="source references" />
      )}
    </div>
  );
};

const getInitialState = () => ({
  algorithm: "pathoscope_bowtie",
  selected: [],
  errorRef: ""
});

export default class CreateAnalysis extends React.Component {
  constructor(props) {
    super(props);
    this.state = getInitialState();
  }

  static propTypes = {
    show: PropTypes.bool,
    samples: PropTypes.array,
    id: PropTypes.string,
    onSubmit: PropTypes.func,
    onHide: PropTypes.func,
    hasHmm: PropTypes.bool,
    refIndexes: PropTypes.array,
    selected: PropTypes.array,
    userId: PropTypes.string
  };

  handleSelect = newEntry => {
    let newSelected = this.state.selected.slice();

    if (find(this.state.selected, ["id", newEntry.id])) {
      newSelected = reject(newSelected, ["id", newEntry.id]);
    } else {
      newSelected = [...newSelected, { ...newEntry }];
    }

    this.setState({ selected: newSelected, errorRef: "" });
  };

  handleSubmit = e => {
    e.preventDefault();

    if (!this.state.selected.length) {
      return this.setState({ errorRef: "Please select reference(s)" });
    }

    this.props.onSubmit(
      this.props.id,
      this.state.selected,
      this.state.algorithm,
      this.props.userId
    );
    this.props.onHide();
  };

  render() {
    const { selected, algorithm } = this.state;

    const jobMessage = this.props.samples
      ? `Start ${selected.length} ${getTaskDisplayName(algorithm)} ${
          selected.length > 1 ? "jobs" : "job"
        }
             on ${this.props.samples.length} ${
          this.props.samples.length > 1 ? "samples" : "sample"
        }.`
      : `Start ${selected.length} ${getTaskDisplayName(algorithm)} ${
          selected.length > 1 ? "jobs" : "job"
        }.`;
    const jobSummary = selected.length ? (
      <div style={{ float: "left" }}>{jobMessage}</div>
    ) : null;

    return (
      <Modal
        show={this.props.show}
        onHide={this.props.onHide}
        onExited={() => this.setState(getInitialState())}
      >
        <Modal.Header>New Analysis</Modal.Header>
        <form onSubmit={this.handleSubmit}>
          <Modal.Body>
            <AlgorithmSelect
              value={algorithm}
              onChange={e => this.setState({ algorithm: e.target.value })}
              hasHmm={this.props.hasHmm}
            />
            <IndexSelect
              indexes={this.props.refIndexes}
              onSelect={this.handleSelect}
              selected={selected}
              error={this.state.errorRef}
            />
          </Modal.Body>
          <Modal.Footer>
            {jobSummary}
            <Button
              type="submit"
              bsStyle="primary"
              icon="play"
              disabled={!!this.state.errorRef}
            >
              Start
            </Button>
          </Modal.Footer>
        </form>
      </Modal>
    );
  }
}
