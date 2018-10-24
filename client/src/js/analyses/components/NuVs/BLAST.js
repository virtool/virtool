import React from "react";
import Moment from "moment";
import numbro from "numbro";
import { ClipLoader } from "halogenium";
import { map } from "lodash-es";
import { Table, Panel } from "react-bootstrap";
import { connect } from "react-redux";

import { blastNuvs } from "../../actions";
import {
  Alert,
  Button,
  Flex,
  FlexItem,
  Icon,
  RelativeTime
} from "../../../base/index";

const ridRoot =
  "https://blast.ncbi.nlm.nih.gov/Blast.cgi?\
    CMD=Web&PAGE_TYPE=BlastFormatting&OLD_BLAST=false&GET_RID_INFO=on&RID=";

export const BLASTInProgress = ({ interval, lastCheckedAt, rid }) => {
  let timing;
  let ridText;
  let ridLink;

  if (rid) {
    const relativeLast = <RelativeTime time={lastCheckedAt} />;
    const relativeNext = Moment(lastCheckedAt)
      .add(interval, "seconds")
      .fromNow();

    ridText = " with RID ";

    ridLink = (
      <a target="_blank" href={ridRoot + rid} rel="noopener noreferrer">
        {rid}{" "}
        <sup>
          <Icon name="new-tab" />
        </sup>
      </a>
    );

    timing = (
      <FlexItem grow={1}>
        <small className="pull-right">
          Last checked {relativeLast}. Checking again in {relativeNext}.
        </small>
      </FlexItem>
    );
  }

  return (
    <Panel>
      <Panel.Body>
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
      </Panel.Body>
    </Panel>
  );
};

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
    <Panel>
      <Panel.Heading>NCBI BLAST</Panel.Heading>
      <Panel.Body>
        <Table condensed>
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
      </Panel.Body>
    </Panel>
  );
};

export const NuVsBLAST = props => {
  if (props.blast) {
    if (props.blast.ready) {
      if (props.blast.result.hits.length) {
        return <BLASTResults hits={props.blast.result.hits} />;
      }

      return (
        <Panel>
          <Panel.Heading>NCBI BLAST</Panel.Heading>
          <Panel.Body>No BLAST hits found.</Panel.Body>
        </Panel>
      );
    }

    return (
      <BLASTInProgress
        interval={props.blast.interval}
        lastCheckedAt={props.blast.last_checked_at}
        rid={props.blast.rid}
      />
    );
  }

  return (
    <Alert bsStyle="warning">
      <Flex alignItems="center">
        <FlexItem>
          <Icon name="info-circle" />
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
