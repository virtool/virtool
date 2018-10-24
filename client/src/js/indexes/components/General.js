import React from "react";
import { map } from "lodash-es";
import { Badge, Panel, ListGroup, ListGroupItem } from "react-bootstrap";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { Flex, FlexItem } from "../../base";

export const PanelBadgeHeader = ({ title, count }) => (
  <Flex alignItems="center">
    <FlexItem>{title}</FlexItem>
    <FlexItem pad>
      <Badge>{count}</Badge>
    </FlexItem>
  </Flex>
);

export const IndexOTUEntry = ({ refId, changeCount, id, name }) => (
  <ListGroupItem>
    <Link to={`/refs/${refId}/otus/${id}`}>{name}</Link>
    <Badge>
      {changeCount} {`change${changeCount > 1 ? "s" : ""}`}
    </Badge>
  </ListGroupItem>
);

export const IndexGeneral = ({ detail }) => {
  const refId = detail.reference.id;

  const contributors = map(detail.contributors, contributor => (
    <ListGroupItem key={contributor.id}>
      {contributor.id}{" "}
      <Badge>
        {contributor.count} {`change${contributor.count === 1 ? "" : "s"}`}
      </Badge>
    </ListGroupItem>
  ));

  const otus = map(detail.otus, otu => (
    <IndexOTUEntry
      key={otu.id}
      refId={refId}
      name={otu.name}
      id={otu.id}
      changeCount={otu.change_count}
    />
  ));

  return (
    <div>
      <Panel>
        <Panel.Heading>
          <PanelBadgeHeader title="Contributors" count={contributors.length} />
        </Panel.Heading>
        <ListGroup>{contributors}</ListGroup>
      </Panel>

      <Panel>
        <Panel.Heading>
          <PanelBadgeHeader title="OTUs" count={otus.length} />
        </Panel.Heading>
        <ListGroup>{otus}</ListGroup>
      </Panel>
    </div>
  );
};

const mapStateToProps = state => ({
  detail: state.indexes.detail
});

export default connect(mapStateToProps)(IndexGeneral);
