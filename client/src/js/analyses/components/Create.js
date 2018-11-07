import React from "react";
import { push } from "connected-react-router";
import { connect } from "react-redux";
import { get, map, find, forEach, xorBy } from "lodash-es";
import { Modal, ListGroup, Col, Label } from "react-bootstrap";
import { AlgorithmSelect, Button, ListGroupItem, NoneFound, Checkbox } from "../../base/index";
import { getTaskDisplayName, routerLocationHasState } from "../../utils/utils";
import { analyze } from "../actions";

export const IndexSelect = ({ indexes, onSelect, selected, error }) => {
    const errorStyle = error.length ? { border: "1px solid #d44b40" } : { border: "1px solid transparent" };

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
                                onClick={() => onSelect({ id: index.id, refId: index.reference.id })}
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

const MultiSummary = ({ algorithm, samples, selected }) => {
    let prefix;
    let suffix;

    if (selected.length) {
        prefix = `Start ${selected.length} ${getTaskDisplayName(algorithm)} ${selected.length > 1 ? "jobs" : "job"}`;

        if (samples) {
            suffix = ` ${this.props.samples.length} ${this.props.samples.length > 1 ? "samples" : "sample"}.`;
        }
    }

    return (
        <div style={{ float: "left" }}>
            {prefix}
            {suffix}
        </div>
    );
};

const getInitialState = () => ({
    algorithm: "pathoscope_bowtie",
    selected: [],
    error: ""
});

export class CreateAnalysis extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState();
    }

    handleSelectIndex = index => {
        this.setState({ selected: xorBy(this.state.selected, [index], "id"), error: "" });
    };

    handleSubmit = e => {
        e.preventDefault();

        if (!this.state.selected.length) {
            return this.setState({ error: "Please select reference(s)" });
        }

        this.props.onAnalyze(this.props.id, this.state.selected, this.state.algorithm, this.props.userId);
        this.props.onHide();
    };

    render() {
        const { selected, algorithm } = this.state;

        return (
            <Modal show={this.props.show} onHide={this.props.onHide} onExited={() => this.setState(getInitialState())}>
                <Modal.Header>New Analysis</Modal.Header>
                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        <AlgorithmSelect
                            value={algorithm}
                            onChange={e => this.setState({ algorithm: e.target.value })}
                            hasHmm={this.props.hasHmm}
                        />
                        <IndexSelect
                            indexes={this.props.indexes}
                            onSelect={this.handleSelectIndex}
                            selected={selected}
                            error={this.state.error}
                        />
                    </Modal.Body>
                    <Modal.Footer>
                        <MultiSummary
                            algorithm={algorithm}
                            samples={this.props.samples}
                            selected={this.state.selected}
                        />
                        <Button type="submit" bsStyle="primary" icon="play" disabled={!!this.state.error}>
                            Start
                        </Button>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}

const mapStateToProps = state => ({
    show: routerLocationHasState(state, "createAnalysis"),
    sampleId: get(state, "samples.detail.id"),
    indexes: state.analyses.readyIndexes
});

const mapDispatchToProps = dispatch => ({
    onAnalyze: (sampleId, references, algorithm, userId) => {
        forEach(references, entry => dispatch(analyze(sampleId, entry.refId, algorithm, userId)));
    },
    onHide: () => {
        dispatch(push({ ...window.location, state: { createAnalysis: false } }));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(CreateAnalysis);
