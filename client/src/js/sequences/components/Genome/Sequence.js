import React from "react";
import { connect } from "react-redux";
import { BoxGroupSection } from "../../../base";
import { useExpanded } from "../../hooks";
import SequenceButtons from "../Sequence/Buttons";
import { SequenceHeader } from "../Sequence/Header";
import { SequenceAccessionValue, SequenceTitleValue } from "../Sequence/Values";
import { GenomeSequenceTable } from "./Table";

const GenomeSequence = ({ accession, definition, host, id, segment, sequence }) => {
    const { expanded, expand, collapse } = useExpanded();

    return (
        <BoxGroupSection onClick={expand}>
            <SequenceHeader>
                <SequenceAccessionValue accession={accession} />
                <SequenceTitleValue>
                    <p>{segment || definition}</p>
                    <small>{segment ? "SEGMENT" : "DEFINITION"}</small>
                </SequenceTitleValue>
                {expanded && <SequenceButtons id={id} onCollapse={collapse} />}
            </SequenceHeader>
            {expanded && (
                <GenomeSequenceTable definition={definition} host={host} segment={segment} sequence={sequence} />
            )}
        </BoxGroupSection>
    );
};

export const mapStateToProps = state => ({
    dataType: state.references.detail.data_type,
    targets: state.references.detail.targets
});

export default connect(mapStateToProps)(GenomeSequence);
