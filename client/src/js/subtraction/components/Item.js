import React from "react";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { Col, Row } from "react-bootstrap";
import { Flex, FlexItem, Icon, ListGroupItem, Loader } from "../../base";

export const SubtractionItemIcon = ({ ready }) => {
    if (ready) {
        return <Icon name="check" bsStyle="success" />;
    }

    return <Loader size="14px" color="#3c8786" />;
};

export const SubtractionItem = ({ id, ready }) => (
    <LinkContainer key={id} className="spaced" to={`/subtraction/${id}`}>
        <ListGroupItem>
            <Row>
                <Col xs={8} md={8}>
                    <strong>{id}</strong>
                </Col>
                <Col xs={4} md={4}>
                    <Flex alignItems="center" className="pull-right">
                        <SubtractionItemIcon ready={ready} />
                        <FlexItem pad>
                            <strong>{ready ? "Ready" : "Importing"}</strong>
                        </FlexItem>
                    </Flex>
                </Col>
            </Row>
        </ListGroupItem>
    </LinkContainer>
);

export const mapStateToProps = (state, props) => {
    const { id, ready } = state.subtraction.documents[props.index];
    return {
        id,
        ready
    };
};

export default connect(mapStateToProps)(SubtractionItem);
