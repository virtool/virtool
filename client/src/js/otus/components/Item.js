import React from "react";
import { LinkContainer } from "react-router-bootstrap";
import { get } from "lodash-es";
import { connect } from "react-redux";
import { Row, Col } from "react-bootstrap";
import { ListGroupItem, Icon } from "../../base";

const OTUItem = ({ refId, entry }) => (
  <LinkContainer
    to={`/refs/${refId}/otus/${entry.id}`}
    key={entry.id}
    className="spaced"
  >
    <ListGroupItem bsStyle={entry.verified ? null : "warning"}>
      <Row>
        <Col xs={11} sm={11} md={7}>
          <strong>{entry.name}</strong>
          <small
            className="hidden-md hidden-lg text-muted"
            style={{ marginLeft: "5px" }}
          >
            {entry.abbreviation}
          </small>
        </Col>
        <Col xsHidden smHidden md={4}>
          {entry.abbreviation}
        </Col>
        <Col xs={1} sm={1} md={1}>
          {entry.verified ? null : (
            <Icon name="tag" pullRight tip="This OTU is unverified" />
          )}
        </Col>
      </Row>
    </ListGroupItem>
  </LinkContainer>
);

const mapStateToProps = (state, props) => ({
  entry: get(state, `otus.documents[${props.index}]`, null)
});

export default connect(mapStateToProps)(OTUItem);
