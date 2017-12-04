import React from "react";
import Moment from "moment";
import Numeral from "numeral";
import { connect } from "react-redux";
import { ClipLoader } from "halogenium";
import { Panel, Alert, Table } from "react-bootstrap";

import { blastNuvs } from "../../../actions";
import { Button, Flex, FlexItem, Icon, RelativeTime } from "../../../../base";

const ridRoot = "https://blast.ncbi.nlm.nih.gov/Blast.cgi?\
    CMD=Web&PAGE_TYPE=BlastFormatting&OLD_BLAST=false&GET_RID_INFO=on&RID=";

const NuVsBLAST = (props) => {

    if (props.blast) {

        if (props.blast.ready) {
            if (props.blast.result.hits.length) {
                const hitComponents = props.blast.result.hits.map((hit, index) =>
                    <tr key={index}>
                        <td>
                            <a target="_blank" href={`https://www.ncbi.nlm.nih.gov/nuccore/${hit.accession}`}>
                                {hit.accession}
                            </a>
                        </td>
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

            return (
                <Panel header="NCBI BLAST">
                    No BLAST hits found.
                </Panel>
            );
        }

        let timing;
        let ridText;
        let ridLink;

        if (props.blast.rid) {
            const relativeLast = <RelativeTime time={props.blast.last_checked_at} />;
            const relativeNext = Moment(props.blast.last_checked_at).add(props.blast.interval, "seconds").fromNow();

            timing = (
                <FlexItem grow={1}>
                    <small className="pull-right">
                        Last checked {relativeLast}. Checking again in {relativeNext}.
                    </small>
                </FlexItem>
            );

            ridText = " with RID ";

            ridLink = (
                <a target="_blank" href={ridRoot + props.blast.rid}>
                    {props.blast.rid} <sup><Icon name="new-tab" /></sup>
                </a>
            );
        }

        return (
            <Panel>
                <Flex alignItems="center">
                    <FlexItem>
                        <ClipLoader size={16} color="#000" />
                    </FlexItem>
                    <FlexItem pad={5}>
                        <span>BLAST in progress {ridText}</span>
                        {ridLink}
                    </FlexItem>
                    {timing}
                </Flex>
            </Panel>
        );
    }

    return (
        <Alert bsStyle="warning">
            <Flex alignItems="center">
                <FlexItem>
                    <Icon name="info" />
                </FlexItem>
                <FlexItem grow={1} pad={5}>
                    This sequence has no BLAST information attached to it.
                </FlexItem>
                <FlexItem pad={10}>
                    <Button
                        bsSize="small"
                        icon="cloud"
                        onClick={() => props.onBlast(props.analysisId, props.sequenceIndex)}
                    >
                        BLAST at NCBI
                    </Button>
                </FlexItem>
            </Flex>
        </Alert>
    );
};

const mapStateToProps = (state) => {
    return {
        analysisId: state.samples.analysisDetail.id
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onBlast: (analysisId, sequenceIndex) => {
            dispatch(blastNuvs(analysisId, sequenceIndex));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(NuVsBLAST);

export default Container;
