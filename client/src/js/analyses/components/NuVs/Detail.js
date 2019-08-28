import React, { useState } from "react";
import Measure from "react-measure";
import { connect } from "react-redux";
import styled from "styled-components";
import { filter, map, sortBy } from "lodash-es";
import { Badge, Box } from "../../../base";
import { getActiveHit, getMaxSequenceLength } from "../../selectors";

import NuVsBLAST from "./BLAST";
import NuVsORF from "./ORF";
import NuVsSequence from "./Sequence";

const StyledNuVsFamilies = styled.div`
    border: 1px solid #ddd;
    border-radius: 3px;
    display: flex;
    margin: 3px 0;

    div {
        padding: 3px 8px;
    }

    div:first-child {
        background-color: #ddd;
        border-right: 1px solid #ddd;
    }
`;

const NuVsFamilies = ({ families }) => (
    <StyledNuVsFamilies>
        <div>Families</div>
        <div>{families.length ? families.join(", ") : "None"}</div>
    </StyledNuVsFamilies>
);

const NuVsLayout = styled.div`
    border: 1px solid #ddd;
    margin-bottom: 15px;

    & > div:nth-child(even) {
        background-color: #f5f5f5;
    }
`;

const NuVsDetailTitle = styled.div`
    margin-bottom: 10px;

    h3 {
        align-items: center;
        display: flex;
        font-size: 14px;
        font-weight: bold;
        justify-content: space-between;
        margin: 0;
    }

    span {
        font-size: 12px;
        font-weight: bold;
    }

    ${Badge} {
        font-size: 12px;
        padding: 3px 7px;
    }
`;

const StyledNuVsDetail = styled(Box)`
    align-items: stretch;
    display: flex;
    flex-direction: column;
    min-height: 500px;
    min-width: 0;
    margin-left: 10px;
`;

export const NuVsDetail = ({ blast, e, families, filterORFs, index, maxSequenceLength, orfs, sequence }) => {
    const [width, setWidth] = useState(-1);

    let filtered;

    if (filterORFs) {
        filtered = filter(orfs, orf => orf.hits.length);
    }

    filtered = sortBy(filtered || orfs, orf => orf.hits.length).reverse();

    const orfComponents = map(filtered, (orf, index) => (
        <NuVsORF key={index} index={index} {...orf} maxSequenceLength={maxSequenceLength} width={width} />
    ));

    return (
        <Measure offset onResize={contentRect => setWidth(contentRect.offset.width)}>
            {({ measureRef }) => (
                <StyledNuVsDetail ref={measureRef}>
                    <NuVsDetailTitle>
                        <h3>
                            Sequence {index}
                            <Badge>{sequence.length} bp</Badge>
                        </h3>
                        <span className="text-success">{orfs.length} ORFs</span> /{" "}
                        <span className="text-danger">E = {e}</span>
                        <NuVsFamilies families={families} />
                    </NuVsDetailTitle>
                    <NuVsLayout>
                        <NuVsSequence key="sequence" sequence={sequence} width={width} />
                        {orfComponents}
                    </NuVsLayout>
                    <NuVsBLAST sequenceIndex={index} blast={blast} sequence={sequence} />
                </StyledNuVsDetail>
            )}
        </Measure>
    );
};

const mapStateToProps = state => {
    return {
        ...getActiveHit(state),
        analysisId: state.analyses.detail.id,
        filterORFs: state.analyses.filterORFs,
        maxSequenceLength: getMaxSequenceLength(state)
    };
};

export default connect(mapStateToProps)(NuVsDetail);
