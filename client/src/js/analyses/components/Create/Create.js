import { forEach, xorBy } from "lodash-es";
import React from "react";
import { Modal } from "react-bootstrap";
import { connect } from "react-redux";
import { pushState } from "../../../app/actions";
import { AlgorithmSelect, Button, Flex, FlexItem } from "../../../base";
import { getSelectedDocuments } from "../../../samples/selectors";
import { analyze } from "../../actions";
import { IndexSelector } from "./IndexSelector";
import { SelectedSamples } from "./SelectedSamples";

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

const getInitialState = ({ defaultSubtraction }) => ({
    algorithm: "pathoscope_bowtie",
    selected: [],
    subtraction: defaultSubtraction,
    error: ""
});

export class CreateAnalysis extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(props);
    }

    handleEnter = () => {
        this.setState(getInitialState(this.props));
    };

    handleSelectAlgorithm = e => {
        this.setState({ algorithm: e.target.value });
    };

    handleSelectIndex = index => {
        this.setState({ selected: xorBy(this.state.selected, [index], "id"), error: "" });
    };

    handleSelectSubtraction = e => {
        this.setState({ subtraction: e.target.value });
    };

    handleSubmit = e => {
        e.preventDefault();

        if (!this.state.selected.length) {
            return this.setState({ error: "Please select reference(s)" });
        }

        this.props.onAnalyze(
            this.props.documents,
            this.state.selected,
            this.state.algorithm,
            this.state.subtraction,
            this.props.userId
        );

        this.props.onHide();
    };

    render() {
        const { selected, algorithm } = this.state;

        const show = !!(this.props.documents && this.props.documents.length);

        return (
            <Modal show={show} onHide={this.props.onHide} onEnter={this.handleEnter}>
                <Modal.Header>Analyze</Modal.Header>
                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        <SelectedSamples samples={this.props.documents} />
                        <AlgorithmSelect
                            value={algorithm}
                            onChange={this.handleSelectAlgorithm}
                            hasHmm={this.props.hasHmm}
                        />
                        <IndexSelector
                            indexes={this.props.indexes}
                            onSelect={this.handleSelectIndex}
                            selected={selected}
                            error={this.state.error}
                        />
                        <Subtrac
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
    hasHmm: !!state.hmms.total_count,
    indexes: state.analyses.readyIndexes,
    defaultSubtraction: state.samples.detail.subtraction.id,
    userId: state.account.id
});

const mapDispatchToProps = dispatch => ({
    onAnalyze: (samples, references, algorithm, subtractionId, userId) => {
        forEach(samples, ({ id }) => {
            forEach(references, ({ refId }) => {
                dispatch(analyze(id, refId, algorithm, subtractionId, userId));
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
