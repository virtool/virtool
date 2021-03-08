import React from "react";
import { connect } from "react-redux";
import { BoxGroupSection } from "../../../base";
import { useExpanded } from "../../hooks";
import SequenceButtons from "../Sequence/Buttons";
import { SequenceHeader } from "../Sequence/Header";
import { SequenceAccessionValue, SequenceTitleValue } from "../Sequence/Values";
import { BarcodeSequenceTable } from "./Table";

const BarcodeSequence = ({ accession, definition, host, id, sequence, target }) => {
    const { expanded, expand, collapse } = useExpanded();

    return (
        <BoxGroupSection onClick={expand}>
            <SequenceHeader>
                <SequenceAccessionValue accession={accession} />
                <SequenceTitleValue label="TARGET" value={target} />
                {expanded && <SequenceButtons id={id} onCollapse={collapse} />}
            </SequenceHeader>

            {expanded && (
                <BarcodeSequenceTable definition={definition} host={host} sequence={sequence} target={target} />
            )}
        </BoxGroupSection>
    );
};

export const mapStateToProps = state => ({ targets: state.references.detail.targets });

export default connect(mapStateToProps)(BarcodeSequence);
