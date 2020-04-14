import { forEach, xorBy } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { pushState } from "../../../app/actions";
import { Button, Flex, FlexItem, ModalDialog, DialogBody, DialogFooter } from "../../../base";
import { getDefaultSubtraction, getSampleLibraryType, getSelectedDocuments } from "../../../samples/selectors";
import { shortlistSubtractions } from "../../../subtraction/actions";
import { analyze } from "../../actions";
import { getCompatibleReadyIndexes } from "../../selectors";
import { AlgorithmSelect } from "./AlgorithmSelect";
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
    algorithm: libraryType === "amplicon" ? "aodp" : "pathoscope_bowtie",
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
        const { selected, subtraction, algorithm } = this.state;

        const show = !!(this.props.documents && this.props.documents.length);

        return (
            <ModalDialog
                headerText="Analyze"
                label="create"
                size="lg"
                show={show}
                onHide={this.props.onHide}
                onEnter={this.handleEnter}
            >
                <form onSubmit={this.handleSubmit}>
                    <DialogBody>
                        <SelectedSamples samples={this.props.documents} />
                        <AlgorithmSelect
                            libraryType={this.props.libraryType}
                            value={algorithm}
                            onChange={this.handleSelectAlgorithm}
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
                    </DialogBody>
                    <DialogFooter>
                        <Flex alignItems="center">
                            <FlexItem grow={1}>
                                <MultiSummary
                                    algorithm={algorithm}
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
                    </DialogFooter>
                </form>
            </ModalDialog>
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
    onAnalyze: (samples, references, algorithm, subtractionId, userId) => {
        forEach(samples, ({ id }) => {
            forEach(references, ({ refId }) => {
                dispatch(analyze(id, refId, algorithm, subtractionId, userId));
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
