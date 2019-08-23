import React from "react";
import { connect } from "react-redux";
import { map, forEach, some, xorBy } from "lodash-es";
import { Badge, Modal, ListGroup, Col } from "react-bootstrap";
import { pushState } from "../../app/actions";
import { AlgorithmSelect, Button, Label, ListGroupItem, NoneFound, Checkbox, FlexItem, Flex } from "../../base/index";
import { getSelectedDocuments } from "../../samples/selectors";
import { analyze } from "../actions";

export const SamplesList = ({ samples }) => {
    const sampleComponents = map(samples, ({ id, name }) => (
        <ListGroupItem key={id} disabled>
            {name}
        </ListGroupItem>
    ));

    let labelContent = "Sample";

    const style = {
        maxHeight: "220px"
    };

    if (samples.length > 1) {
        labelContent = (
            <span>
                Samples <Badge>{samples.length}</Badge>
            </span>
        );

        style.overflowY = "scroll";
    }

    return (
        <div style={{ marginBottom: "16px" }}>
            <label className="control-label">{labelContent}</label>
            <div style={style}>
                <ListGroup style={{ marginBottom: 0 }}>{sampleComponents}</ListGroup>
            </div>
        </div>
    );
};

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
                        {map(indexes, index => {
                            const isSelected = some(selected, { id: index.id });
                            return (
                                <ListGroupItem
                                    key={index.id}
                                    onClick={() => onSelect({ id: index.id, refId: index.reference.id })}
                                >
                                    <Col xs={1}>
                                        <Checkbox checked={isSelected} />
                                    </Col>
                                    <Col xs={8}>
                                        <strong>{index.reference.name}</strong>
                                    </Col>
                                    <Col xs={3}>
                                        Index Version <Label>{index.version}</Label>
                                    </Col>
                                </ListGroupItem>
                            );
                        })}
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

const MultiSummary = ({ samples, selected }) => {
    const product = selected.length * samples.length;

    if (product === 0) {
        return null;
    }

    return (
        <div style={{ textAlign: "left" }}>
            {product} job
            {product === 1 ? "" : "s"} will be started
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

    handleExited = () => {
        this.setState(getInitialState());
    };

    handleSelectAlgorithm = e => {
        this.setState({ algorithm: e.target.value });
    };

    handleSelectIndex = index => {
        this.setState({ selected: xorBy(this.state.selected, [index], "id"), error: "" });
    };

    handleSubmit = e => {
        e.preventDefault();

        if (!this.state.selected.length) {
            return this.setState({ error: "Please select reference(s)" });
        }

        this.props.onAnalyze(this.props.documents, this.state.selected, this.state.algorithm, this.props.userId);
        this.props.onHide();
    };

    render() {
        const { selected, algorithm } = this.state;

        const show = !!(this.props.documents && this.props.documents.length);

        return (
            <Modal show={show} onHide={this.props.onHide} onExited={this.handleExited}>
                <Modal.Header>Analyze</Modal.Header>
                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        <SamplesList samples={this.props.documents} />
                        <AlgorithmSelect
                            value={algorithm}
                            onChange={this.handleSelectAlgorithm}
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
                        <Flex alignItems="center">
                            <FlexItem grow={1}>
                                <MultiSummary
                                    algorithm={algorithm}
                                    samples={this.props.documents}
                                    selected={this.state.selected}
                                />
                            </FlexItem>
                            <FlexItem>
                                <Button type="submit" bsStyle="primary" icon="play" disabled={!!this.state.error}>
                                    Start
                                </Button>
                            </FlexItem>
                        </Flex>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}

const mapStateToProps = state => ({
    documents: getSelectedDocuments(state),
    indexes: state.analyses.readyIndexes,
    userId: state.account.id,
    hasHmm: !!state.hmms.total_count
});

const mapDispatchToProps = dispatch => ({
    onAnalyze: (samples, references, algorithm, userId) => {
        forEach(samples, ({ id }) => {
            forEach(references, ({ refId }) => {
                dispatch(analyze(id, refId, algorithm, userId));
            });
        });
    },
    onHide: () => {
        dispatch(pushState({}));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(CreateAnalysis);
