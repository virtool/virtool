import { map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { getFontSize } from "../../app/theme";
import { Badge, BoxGroup, NoneFoundSection } from "../../base";
import { getActiveIsolate } from "../../otus/selectors";
import { getDataType } from "../../references/selectors";
import { formatIsolateName } from "../../utils/utils";
import { getSequences } from "../selectors";
import AddSequence from "./Add";
import AddSequenceLink from "./AddLink";
import BarcodeSequence from "./Barcode/Sequence";
import EditSequence from "./Edit";
import GenomeSequence from "./Genome/Sequence";
import RemoveSequence from "./Remove";

const IsolateSequencesHeader = styled.label`
    align-items: center;
    display: flex;
    font-weight: ${getFontSize("thick")};

    strong {
        font-size: ${getFontSize("lg")};
        padding-right: 5px;
    }
`;

export const IsolateSequences = ({ dataType, isolateName, sequences }) => {
    const Sequence = dataType === "barcode" ? BarcodeSequence : GenomeSequence;

    let sequenceComponents;

    if (sequences.length) {
        sequenceComponents = map(sequences, sequence => <Sequence key={sequence.id} {...sequence} />);
    } else {
        sequenceComponents = <NoneFoundSection noun="sequences" />;
    }

    return (
        <React.Fragment>
            <IsolateSequencesHeader>
                <strong>Sequences</strong>
                <Badge>{sequences.length}</Badge>
                <AddSequenceLink />
            </IsolateSequencesHeader>

            <BoxGroup>{sequenceComponents}</BoxGroup>

            <AddSequence />
            <EditSequence />
            <RemoveSequence isolateName={isolateName} />
        </React.Fragment>
    );
};

export const mapStateToProps = state => ({
    dataType: getDataType(state),
    isolateName: formatIsolateName(getActiveIsolate(state)),
    sequences: getSequences(state)
});

export default connect(mapStateToProps)(IsolateSequences);
