import { forEach } from "lodash-es";
import React, { useEffect } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { getAccountId } from "../../../account/selectors";
import { pushState } from "../../../app/actions";
import { Badge, Button, Icon, Modal, ModalBody, ModalFooter, ModalHeader, ModalTabs, TabLink } from "../../../base";
import { deselectSamples } from "../../../samples/actions";
import { getDefaultSubtraction, getSelectedSamples } from "../../../samples/selectors";
import { shortlistSubtractions } from "../../../subtraction/actions";
import { analyze } from "../../actions";
import {
    getCompatibleIndexesWithDataType,
    getCompatibleSamples,
    getQuickAnalysisGroups,
    getQuickAnalysisMode
} from "../../selectors";
import HMMAlert from "../HMMAlert";
import { useCreateAnalysis } from "./hooks";
import { IndexSelector } from "./IndexSelector";
import { SelectedSamples } from "./SelectedSamples";
import { SubtractionSelector } from "./SubtractionSelector";
import { CreateAnalysisSummary } from "./Summary";
import { WorkflowSelector } from "./WorkflowSelector";

const QuickAnalyzeFooter = styled(ModalFooter)`
    align-items: center;
    display: flex;
    justify-content: space-between;
`;

const QuickAnalyzeSelected = styled.span`
    align-self: center;
    margin: 0 15px 0 auto;
`;

export const QuickAnalyze = ({
    accountId,
    compatibleIndexes,
    compatibleSamples,
    barcode,
    genome,
    hasHmm,
    mode,
    samples,
    subtractions,
    onAnalyze,
    onHide,
    onShortlistSubtractions,
    onUnselect
}) => {
    const show = !!mode;

    useEffect(() => {
        onShortlistSubtractions();
    }, [show]);

    // The dialog should close when all selected samples have been analyzed and deselected.
    useEffect(() => {
        if (compatibleSamples.length === 0) {
            onHide();
        }
    }, [mode]);

    // This hook is shared with the analyze modal for single samples.
    const {
        error,
        indexes,
        subtraction,
        workflows,
        setError,
        setSubtraction,
        toggleIndex,
        toggleWorkflow
    } = useCreateAnalysis(mode);

    const handleSubmit = e => {
        e.preventDefault();

        if (!indexes.length) {
            return setError("Please select reference(s)");
        }

        if (!workflows.length) {
            return setError("Please select workflow(s)");
        }

        onAnalyze(compatibleSamples, indexes, subtraction, accountId, workflows);
        onUnselect(compatibleSamples.map(sample => sample.id));
    };

    return (
        <Modal label="Quick Analyze" show={show} size="lg" onHide={onHide}>
            <ModalHeader>Quick Analyze</ModalHeader>
            <ModalTabs>
                {genome.length > 0 && (
                    <TabLink to={{ state: { quickAnalysis: "genome" } }} isActive={() => mode === "genome"}>
                        <Icon name="dna" /> Genome <Badge>{genome.length}</Badge>
                    </TabLink>
                )}
                {barcode.length > 0 && (
                    <TabLink to={{ state: { quickAnalysis: "barcode" } }} isActive={() => mode === "barcode"}>
                        <Icon name="barcode" /> Barcode <Badge>{barcode.length}</Badge>
                    </TabLink>
                )}
                <QuickAnalyzeSelected>{samples.length} samples selected</QuickAnalyzeSelected>
            </ModalTabs>
            <form onSubmit={handleSubmit}>
                <ModalBody>
                    {mode === "genome" && <HMMAlert />}
                    <SelectedSamples samples={compatibleSamples} />
                    <WorkflowSelector
                        dataType={mode || "genome"}
                        hasHmm={hasHmm}
                        workflows={workflows}
                        onSelect={toggleWorkflow}
                    />
                    {mode === "genome" && (
                        <SubtractionSelector
                            subtractions={subtractions}
                            value={subtraction}
                            onChange={setSubtraction}
                        />
                    )}
                    <IndexSelector
                        indexes={compatibleIndexes}
                        onSelect={toggleIndex}
                        selected={indexes}
                        error={error}
                    />
                </ModalBody>
                <QuickAnalyzeFooter>
                    <CreateAnalysisSummary
                        indexCount={indexes.length}
                        sampleCount={compatibleSamples.length}
                        workflowCount={workflows.length}
                    />
                    <Button type="submit" color="blue" icon="play">
                        Start
                    </Button>
                </QuickAnalyzeFooter>
            </form>
        </Modal>
    );
};

export const mapStateToProps = state => ({
    ...getQuickAnalysisGroups(state),
    accountId: getAccountId(state),
    compatibleIndexes: getCompatibleIndexesWithDataType(state),
    compatibleSamples: getCompatibleSamples(state),
    defaultSubtraction: getDefaultSubtraction(state),
    hasHmm: !!state.hmms.total_count,
    mode: getQuickAnalysisMode(state),
    samples: getSelectedSamples(state),
    subtractions: state.subtraction.shortlist
});

export const mapDispatchToProps = dispatch => ({
    onAnalyze: (samples, references, subtractionId, accountId, workflows) => {
        forEach(samples, ({ id }) => {
            forEach(references, ({ refId }) => {
                forEach(workflows, workflow => dispatch(analyze(id, refId, subtractionId, accountId, workflow)));
            });
        });
    },
    onHide: () => {
        dispatch(pushState({ quickAnalysis: false }));
    },
    onShortlistSubtractions: () => {
        dispatch(shortlistSubtractions());
    },
    onUnselect: sampleIds => {
        dispatch(deselectSamples(sampleIds));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(QuickAnalyze);
