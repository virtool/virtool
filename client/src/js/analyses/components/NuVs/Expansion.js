import React from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import { map } from "lodash-es";

import NuVsBLAST from "./BLAST";
import NuVsORF from "./ORF";
import NuVsSequence from "./Sequence";

const NuVsLayout = styled.div`
    border: 1px solid #ddd;
    margin: 10px 0;

    & > div:nth-child(even) {
        background-color: #f5f5f5;
    }
`;

const NuVsExpansion = ({ blast, index, maxSequenceLength, orfs, sequence }) => {
    const orfComponents = map(orfs, (orf, index) => (
        <NuVsORF key={index} index={index} {...orf} maxSequenceLength={maxSequenceLength} />
    ));

    return (
        <React.Fragment>
            <NuVsLayout>
                <NuVsSequence key="sequence" sequence={sequence} />
                {orfComponents}
            </NuVsLayout>

            <NuVsBLAST sequenceIndex={index} blast={blast} sequence={sequence} />
        </React.Fragment>
    );
};

NuVsExpansion.propTypes = {
    index: PropTypes.number,
    analysisId: PropTypes.string,
    blast: PropTypes.object,
    orfs: PropTypes.arrayOf(PropTypes.object),
    sequence: PropTypes.string,
    maxSequenceLength: PropTypes.number
};

export default NuVsExpansion;
