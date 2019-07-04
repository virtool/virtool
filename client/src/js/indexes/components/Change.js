import React from "react";
import { Row, Col } from "react-bootstrap";
import { connect } from "react-redux";
import { SpacedBox } from "../../base";

export const IndexChange = ({ description, otuName }) => (
    <SpacedBox>
        <Row>
            <Col xs={12} md={6}>
                <strong>{otuName}</strong>
            </Col>
            <Col xs={12} md={6}>
                {description}
            </Col>
        </Row>
    </SpacedBox>
);

const mapStateToProps = (state, ownProps) => {
    const { otu, description } = state.indexes.history.documents[ownProps.index];
    return {
        description,
        otuName: otu.name
    };
};

export default connect(mapStateToProps)(IndexChange);
