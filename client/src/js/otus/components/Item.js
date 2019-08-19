import React from "react";
import { LinkContainer } from "react-router-bootstrap";
import { get } from "lodash-es";
import { connect } from "react-redux";
import { Row, Col } from "react-bootstrap";
import { ListGroupItem, Icon } from "../../base";

export const OTUItem = ({ abbreviation, id, name, refId, verified }) => (
    <LinkContainer to={`/refs/${refId}/otus/${id}`} key={id} className="spaced">
        <ListGroupItem bsStyle={verified ? null : "warning"}>
            <Row>
                <Col xs={11} sm={11} md={7}>
                    <strong>{name}</strong>
                    <small className="hidden-md hidden-lg text-muted" style={{ marginLeft: "5px" }}>
                        {abbreviation}
                    </small>
                </Col>
                <Col xsHidden smHidden md={4}>
                    {abbreviation}
                </Col>
                <Col xs={1} sm={1} md={1}>
                    {verified ? null : <Icon name="tag" pullRight tip="This OTU is unverified" />}
                </Col>
            </Row>
        </ListGroupItem>
    </LinkContainer>
);

export const mapStateToProps = (state, props) => {
    const { abbreviation, id, name, verified } = get(state, ["otus", "documents", props.index]);
    return {
        abbreviation,
        id,
        name,
        verified,
        refId: state.references.detail.id
    };
};

export default connect(mapStateToProps)(OTUItem);
