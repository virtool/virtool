import { map } from "lodash-es";
import numbro from "numbro";
import React, { useCallback } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Box, BoxGroup, BoxGroupHeader, BoxTitle, Button, Icon, InfoAlert, Table } from "../../../base";

import { blastNuvs } from "../../actions";
import { BLASTInProgress } from "./BLASTInProgress";

export const BLASTButton = styled(Button)`
    margin-left: auto;
`;

export const BLASTResults = ({ hits }) => {
    const components = map(hits, (hit, index) => (
        <tr key={index}>
            <td>
                <a
                    target="_blank"
                    href={`https://www.ncbi.nlm.nih.gov/nuccore/${hit.accession}`}
                    rel="noopener noreferrer"
                >
                    {hit.accession}
                </a>
            </td>
            <td>{hit.name}</td>
            <td>{hit.evalue}</td>
            <td>{hit.score}</td>
            <td>{numbro(hit.identity / hit.align_len).format("0.00")}</td>
        </tr>
    ));

    return (
        <BoxGroup>
            <BoxGroupHeader>
                <h2>NCBI BLAST</h2>
            </BoxGroupHeader>
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
        if (blast.ready) {
            if (blast.result.hits.length) {
                return <BLASTResults hits={blast.result.hits} />;
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
        <InfoAlert level>
            <Icon name="info-circle" />
            <span>This sequence has no BLAST information attached to it.</span>
            <BLASTButton bsSize="small" icon="cloud" onClick={handleBlast}>
                BLAST at NCBI
            </BLASTButton>
        </InfoAlert>
    );
};

const mapStateToProps = state => ({
    analysisId: state.analyses.detail.id
});

const mapDispatchToProps = dispatch => ({
    onBlast: (analysisId, sequenceIndex) => {
        dispatch(blastNuvs(analysisId, sequenceIndex));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(NuVsBLAST);
