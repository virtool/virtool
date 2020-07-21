import { map } from "lodash-es";
import numbro from "numbro";
import React, { useCallback } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Alert, Box, BoxGroup, BoxGroupHeader, BoxTitle, Button, ExternalLink, Icon, Table } from "../../../base";

import { blastNuvs } from "../../actions";
import { getActiveHit } from "../../selectors";
import { BLASTError } from "./BLASTError";
import { BLASTInProgress } from "./BLASTInProgress";

export const BLASTButton = styled(Button)`
    font-weight: 600;
    margin-left: auto;
`;

const StyledBLASTResultsHeader = styled(BoxGroupHeader)`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
`;

export const BLASTResults = ({ hits, onBlast }) => {
    const components = map(hits, (hit, index) => (
        <tr key={index}>
            <td>
                <ExternalLink href={`https://www.ncbi.nlm.nih.gov/nuccore/${hit.accession}`}>
                    {hit.accession}
                </ExternalLink>
            </td>
            <td>{hit.name}</td>
            <td>{hit.evalue}</td>
            <td>{hit.score}</td>
            <td>{numbro(hit.identity / hit.align_len).format("0.00")}</td>
        </tr>
    ));

    return (
        <BoxGroup>
            <StyledBLASTResultsHeader>
                <strong>NCBI BLAST</strong>
                <a href="#" onClick={onBlast}>
                    <Icon name="redo" /> Retry
                </a>
            </StyledBLASTResultsHeader>
            <Table>
                <thead>
                    <tr>
                        <th>Accession</th>
                        <th>Name</th>
                        <th>E-value</th>
                        <th>Score</th>
                        <th>Identity</th>
                    </tr>
                </thead>
                <tbody>{components}</tbody>
            </Table>
        </BoxGroup>
    );
};

export const NuVsBLAST = ({ analysisId, blast, sequenceIndex, onBlast }) => {
    const handleBlast = useCallback(() => onBlast(analysisId, sequenceIndex), [analysisId, sequenceIndex]);

    if (blast) {
        if (blast.error) {
            return <BLASTError error={blast.error} onBlast={handleBlast} />;
        }

        if (blast.ready) {
            if (blast.result.hits.length) {
                return <BLASTResults hits={blast.result.hits} onBlast={handleBlast} />;
            }

            return (
                <Box>
                    <BoxTitle>NCBI BLAST</BoxTitle>
                    <p>No BLAST hits found.</p>
                </Box>
            );
        }

        return <BLASTInProgress interval={blast.interval} lastCheckedAt={blast.last_checked_at} rid={blast.rid} />;
    }

    return (
        <Alert color="purple" level>
            <Icon name="info-circle" />
            <span>This sequence has no BLAST information attached to it.</span>
            <BLASTButton color="purple" icon="cloud" onClick={handleBlast}>
                BLAST at NCBI
            </BLASTButton>
        </Alert>
    );
};

export const mapStateToProps = state => {
    const { blast, index } = getActiveHit(state);

    return {
        analysisId: state.analyses.detail.id,
        blast,
        sequenceIndex: index
    };
};

export const mapDispatchToProps = dispatch => ({
    onBlast: (analysisId, sequenceIndex) => {
        dispatch(blastNuvs(analysisId, sequenceIndex));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(NuVsBLAST);
