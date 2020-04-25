import { forEach, xorBy } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { pushState } from "../../../app/actions";
import { Button, Flex, FlexItem, Modal, ModalBody, ModalFooter, ModalHeader } from "../../../base";
import { getDefaultSubtraction, getSampleLibraryType, getSelectedDocuments } from "../../../samples/selectors";
import { shortlistSubtractions } from "../../../subtraction/actions";
import { analyze } from "../../actions";
import { getCompatibleReadyIndexes } from "../../selectors";
import { WorkflowSelect } from "./WorkflowSelect";
import { IndexSelector } from "./IndexSelector";
import { SelectedSamples } from "./SelectedSamples";
import { SubtractionSelector } from "./SubtractionSelector";

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

const getInitialState = ({ defaultSubtraction, libraryType }) => ({
    workflow: libraryType === "amplicon" ? "aodp" : "pathoscope_bowtie",
    selected: [],
    subtraction: defaultSubtraction,
    error: ""
});

export class CreateAnalysis extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(props);
    }

    componentDidMount() {
        this.props.onShortlistSubtractions();
    }

    handleEnter = () => {
        this.props.onShortlistSubtractions();
        this.setState(getInitialState(this.props));
    };

    handleSelectWorkflow = e => {
        this.setState({ workflow: e.target.value });
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
            this.state.subtraction,
            this.props.userId,
            this.state.workflow
        );

        this.props.onHide();
    };

    render() {
        const { selected, subtraction, workflow } = this.state;

        const show = !!(this.props.documents && this.props.documents.length);

        return (
            <Modal label="Analyze" show={show} size="lg" onHide={this.props.onHide} onEnter={this.handleEnter}>
                <ModalHeader>Analyze</ModalHeader>
                <form onSubmit={this.handleSubmit}>
                    <ModalBody>
                        <SelectedSamples samples={this.props.documents} />
                        <WorkflowSelect
                            libraryType={this.props.libraryType}
                            value={workflow}
                            onChange={this.handleSelectWorkflow}
                            hasHmm={this.props.hasHmm}
                        />
                        <SubtractionSelector
                            subtractions={this.props.subtractions}
                            value={subtraction}
                            onChange={this.handleSelectSubtraction}
                        />
                        <IndexSelector
                            indexes={this.props.indexes}
                            onSelect={this.handleSelectIndex}
                            selected={selected}
                            error={this.state.error}
                        />
                    </ModalBody>
                    <ModalFooter>
                        <Flex alignItems="center">
                            <FlexItem grow={1}>
                                <MultiSummary
                                    workflow={workflow}
                                    samples={this.props.documents}
                                    selected={this.state.selected}
                                />
                            </FlexItem>
                            <FlexItem>
                                <Button type="submit" color="blue" icon="play" disabled={!!this.state.error}>
                                    Start
                                </Button>
                            </FlexItem>
                        </Flex>
                    </ModalFooter>
                </form>
            </Modal>
        );
    }
}

const mapStateToProps = state => ({
    defaultSubtraction: getDefaultSubtraction(state),
    documents: getSelectedDocuments(state),
    hasHmm: !!state.hmms.total_count,
    indexes: getCompatibleReadyIndexes(state),
    libraryType: getSampleLibraryType(state),
    subtractions: state.subtraction.shortlist,
    userId: state.account.id
});

const mapDispatchToProps = dispatch => ({
    onAnalyze: (samples, references, subtractionId, userId, workflow) => {
        forEach(samples, ({ id }) => {
            forEach(references, ({ refId }) => {
                dispatch(analyze(id, refId, subtractionId, userId, workflow));
            });
        });
    },
    onHide: () => {
        dispatch(pushState({}));
    },
    onShortlistSubtractions: () => {
        dispatch(shortlistSubtractions());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(CreateAnalysis);
