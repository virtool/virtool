import React from "react";
import { sortBy, some, assign, filter, reduce } from "lodash";

import NuVsController from "./Controller";

const NuVsViewer = (props) => {

    // The length of the longest sequence will be stored here.
    let maxSequenceLength = 0;

    const significantHmms = filter(props.hmm, hmm => hmm.full_e < 1e-10);

    let sequences = props.sequences.map((sequence) => {

        if (sequence.sequence.length > maxSequenceLength) {
            maxSequenceLength = sequence.sequence.length;
        }

        const sequenceEntry = assign({}, sequence);
        const sequenceHmms = filter(significantHmms, {index: sequence.index});

        let minE = 10;

        sequenceEntry.orfs = filter(props.orfs, {index: sequence.index}).map(function (orf) {
            // The significant HMM hits associated with this ORF;
            const orfHmms = filter(sequenceHmms, {orf_index: orf.orf_index});

            // The lowest e-value for HMMs associated with this ORF.
            const orfMinE = reduce(orfHmms, (min, hmm) => hmm.full_e < min ? hmm.full_e: min, 10);

            // Update the sequence minimum HMM e-value if the one for this ORF is lower.
            if (minE > orfMinE) {
                minE = orfMinE;
            }

            return assign({
                hmms: orfHmms,
                hasHmm: orfHmms.length > 0,
                minE: orfMinE
            }, orf);
        });

        assign(sequenceEntry, {
            minE: minE,
            hasSignificantOrf: some(sequenceEntry.orfs, {hasHmm: true}),
            orfs: sortBy(sequenceEntry.orfs, "pos[0]")
        });

        return sequenceEntry;

    });

    sequences = sortBy(sequences, "minE");

    return (
        <NuVsController
            data={sequences}
            analysisId={props._id}
            maxSequenceLength={maxSequenceLength}
        />
    );
};

NuVsViewer.propTypes = {
    _id: React.PropTypes.string,
    sequences: React.PropTypes.array,
    hmm: React.PropTypes.array,
    orfs: React.PropTypes.array
};

export default NuVsViewer;

