import { forEach } from "lodash-es";
import React, { useEffect } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { getAccountId } from "../../../account/selectors";
import { pushState } from "../../../app/actions";
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from "../../../base";
import { getDefaultSubtraction, getSampleDetailId, getSampleLibraryType } from "../../../samples/selectors";
import { getDataTypeFromLibraryType } from "../../../samples/utils";
import { shortlistSubtractions } from "../../../subtraction/actions";
import { routerLocationHasState } from "../../../utils/utils";
import { analyze } from "../../actions";
import { getCompatibleIndexesWithLibraryType } from "../../selectors";
import HMMAlert from "../HMMAlert";
import { useCreateAnalysis } from "./hooks";
import { IndexSelector } from "./IndexSelector";
import { SubtractionSelector } from "./SubtractionSelector";
import { CreateAnalysisSummary } from "./Summary";
import { WorkflowSelector } from "./WorkflowSelector";

const CreateAnalysisFooter = styled(ModalFooter)`
    align-items: center;
    display: flex;
    justify-content: space-between;
`;

export const CreateAnalysis = ({
    accountId,
    compatibleIndexes,
    dataType,
    defaultSubtraction,
    hasHmm,
    sampleId,
    show,
    subtractions,
    onAnalyze,
    onHide,
    onShortlistSubtractions
}) => {
    useEffect(() => {
        if (show) {
            onShortlistSubtractions();
        }
    }, [show]);

    const {
        error,
        indexes,
        subtraction,
        workflows,
        setError,
        setSubtraction,
        toggleIndex,
        toggleWorkflow
    } = useCreateAnalysis(dataType, defaultSubtraction);

    const handleSubmit = e => {
        e.preventDefault();

        if (!indexes.length) {
            setError("Please select reference(s)");
            return;
        }

        if (!workflows.length) {
            setError("Please select workflow(s)");
            return;
        }

        onAnalyze(sampleId, indexes, subtraction, accountId, workflows);
        onHide();
    };

    return (
        <Modal label="Analyze" show={show} size="lg" onHide={onHide}>
            <ModalHeader>Analyze</ModalHeader>
            <form onSubmit={handleSubmit}>
                <ModalBody>
                    <HMMAlert />
                    <WorkflowSelector
                        dataType={dataType}
                        hasHmm={hasHmm}
                        workflows={workflows}
                        onSelect={toggleWorkflow}
                    />
                    {dataType === "genome" && (
                        <SubtractionSelector
                            subtractions={subtractions}
                            value={subtraction}
                            onChange={e => setSubtraction(e.target.value)}
                        />
                    )}
                    <IndexSelector
                        error={error}
                        indexes={compatibleIndexes}
                        selected={indexes}
                        onSelect={toggleIndex}
                    />
                </ModalBody>
                <CreateAnalysisFooter>
                    <CreateAnalysisSummary
                        sampleCount={1}
                        indexCount={indexes.length}
                        workflowCount={workflows.length}
                    />
                    <Button type="submit" color="blue" icon="play">
                        Start
                    </Button>
                </CreateAnalysisFooter>
            </form>
        </Modal>
    );
};

export const mapStateToProps = state => ({
    accountId: getAccountId(state),
    compatibleIndexes: getCompatibleIndexesWithLibraryType(state),
    dataType: getDataTypeFromLibraryType(getSampleLibraryType(state)),
    defaultSubtraction: getDefaultSubtraction(state),
    hasHmm: !!state.hmms.total_count,
    sampleId: getSampleDetailId(state),
    show: routerLocationHasState(state, "createAnalysis"),
    subtractions: state.subtraction.shortlist
});

export const mapDispatchToProps = dispatch => ({
    onAnalyze: (sampleId, references, subtractionId, accountId, workflows) => {
        forEach(references, ({ refId }) => {
            forEach(workflows, workflow => dispatch(analyze(sampleId, refId, subtractionId, accountId, workflow)));
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
