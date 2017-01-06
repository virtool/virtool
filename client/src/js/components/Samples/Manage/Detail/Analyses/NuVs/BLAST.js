import Numeral from "numeral";
import React from "react";
import { Panel, Alert, Table } from "react-bootstrap";
import { Icon, Flex, FlexItem, Button } from "virtool/js/components/Base";

const nuccoreRoot = "https://www.ncbi.nlm.nih.gov/nuccore/";

const ridRoot = "https://blast.ncbi.nlm.nih.gov/Blast.cgi?\
    CMD=Web&PAGE_TYPE=BlastFormatting&OLD_BLAST=false&GET_RID_INFO=on&RID=";

const requestBLAST = (analysisId, sequenceIndex) => {
    dispatcher.db.analyses.request("blast_nuvs_sequence", {
        _id: analysisId,
        sequence_index: sequenceIndex
    })
};

const NuVsBLAST = (props) => {

    if (props.blast) {

        if (this.props.blast.ready) {
            const hitComponents = props.blast.hits.map((hit, index) =>
                <tr key={index}>
                    <td><a target="_blank" href={nuccoreRoot + hit.accession}>{hit.accession}</a></td>
                    <td>{hit.name}</td>
                    <td>{hit.evalue}</td>
                    <td>{hit.score}</td>
                    <td>{Numeral(hit.identity / hit.align_len).format("0.00")}</td>
                </tr>
            );

            return (
                <Panel header="NCBI BLAST">
                    <Table fill condensed>
                        <thead>
                            <tr>
                                <th>Accession</th>
                                <th>Name</th>
                                <th>E-value</th>
                                <th>Score</th>
                                <th>Identity</th>
                            </tr>
                        </thead>
                        <tbody>
                            {hitComponents}
                        </tbody>
                    </Table>
                </Panel>
            );
        }

        const ridHref = ridRoot + props.blast.rid;

        return (
            <Alert bsStyle="info">
                <span>BLAST in progress with RID </span>
                <a target="_blank" href={ridHref}>{props.blast.rid} <sup><Icon name="new-tab" /></sup></a>
            </Alert>
        );
    }

    return (
        <Alert bsStyle="info">
            <Flex alignItems="center">
                <FlexItem>
                    <Icon name="info" />
                </FlexItem>
                <FlexItem grow={1} pad={5}>
                    This sequence has no BLAST information attached to it.
                </FlexItem>
                <FlexItem pad={10}>
                    <Button
                        bsStyle="primary"
                        bsSize="small"
                        onClick={() => requestBLAST(props.analysisId, props.sequenceIndex)}
                    >
                        BLAST
                    </Button>
                </FlexItem>
            </Flex>
        </Alert>
    );
};

NuVsBLAST.propTypes = {
    analysisId: React.PropTypes.string,
    sequenceIndex: React.PropTypes.number,
    blast: React.PropTypes.object
};

export default NuVsBLAST;
