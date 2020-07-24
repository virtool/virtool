import { filter, map, sortBy } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { getBorder } from "../../../app/theme";
import { Badge, Box } from "../../../base";
import { useElementSize } from "../../../utils/hooks";
import { getActiveHit, getMaxSequenceLength } from "../../selectors";
import NuVsBLAST from "./BLAST";
import { NuVsORF } from "./ORF";
import { NuVsSequence } from "./Sequence";
import { NuVsValues } from "./Values";

const StyledNuVsFamilies = styled.div`
    border: ${getBorder};
    border-radius: ${props => props.theme.borderRadius.sm};
    display: flex;
    margin: 10px 0 5px;
    overflow: hidden;

    div {
        padding: 5px 10px;
    }

    div:first-child {
        background-color: ${props => props.theme.color.greyLightest};
        border-right: ${getBorder};
    }
`;

const NuVsFamilies = ({ families }) => (
    <StyledNuVsFamilies>
        <div>Families</div>
        <div>{families.length ? families.join(", ") : "None"}</div>
    </StyledNuVsFamilies>
);

const NuVsLayout = styled.div`
    border: ${getBorder};
    margin-bottom: 15px;

    & > div:nth-child(even) {
        background-color: ${props => props.theme.color.greyLightest};
    }
`;

const NuVsDetailTitle = styled.div`
    margin-bottom: 10px;

    h3 {
        align-items: center;
        display: flex;
        font-size: ${props => props.theme.fontSize.lg};
        font-weight: bold;
        justify-content: space-between;
        margin: 0;
    }

    span {
        font-size: ${props => props.theme.fontSize.md};
        font-weight: bold;
    }

    ${Badge} {
        font-size: ${props => props.theme.fontSize.md};
        padding: 5px 10px;
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

export const NuVsDetail = ({ filterORFs, hit, maxSequenceLength }) => {
    const [ref, { width }] = useElementSize();

    if (!hit) {
        return <StyledNuVsDetail>No Hits</StyledNuVsDetail>;
    }

    const { e, families, index, orfs, sequence } = hit;

    let filtered;

    if (filterORFs) {
        filtered = filter(orfs, orf => orf.hits.length);
    }

    filtered = sortBy(filtered || orfs, orf => orf.hits.length).reverse();

    const orfComponents = map(filtered, (orf, index) => (
        <NuVsORF key={index} index={index} {...orf} maxSequenceLength={maxSequenceLength} width={width} />
    ));

    return (
        <StyledNuVsDetail ref={ref}>
            <NuVsDetailTitle>
                <h3>
                    Sequence {index}
                    <Badge>{sequence.length} bp</Badge>
                </h3>
                <NuVsValues e={e} orfCount={orfs.length} />
                <NuVsFamilies families={families} />
            </NuVsDetailTitle>
            <NuVsLayout>
                <NuVsSequence key="sequence" maxSequenceLength={maxSequenceLength} sequence={sequence} width={width} />
                {orfComponents}
            </NuVsLayout>
            <NuVsBLAST />
        </StyledNuVsDetail>
    );
};

const mapStateToProps = state => ({
    filterORFs: state.analyses.filterORFs,
    maxSequenceLength: getMaxSequenceLength(state),
    hit: getActiveHit(state)
});

export default connect(mapStateToProps)(NuVsDetail);
