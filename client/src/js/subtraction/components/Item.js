import React from "react";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { Col, Row } from "react-bootstrap";
import { get } from "lodash-es";

import { Flex, FlexItem, Icon, ListGroupItem, Loader } from "../../base";

const SubtractionItem = ({ entry }) => {
    let icon;

    if (entry.ready) {
        icon = <Icon name="check" bsStyle="success" />;
    } else {
        icon = <Loader size="14px" color="#3c8786" />;
    }

    return (
        <LinkContainer key={entry.id} className="spaced" to={`/subtraction/${entry.id}`}>
            <ListGroupItem>
                <Row>
                    <Col xs={8} md={8}>
                        <strong>{entry.id}</strong>
                    </Col>
                    <Col xs={4} md={4}>
                        <Flex alignItems="center" className="pull-right">
                            {icon}
                            <FlexItem pad>
                                <strong>{entry.ready ? "Ready" : "Importing"}</strong>
                            </FlexItem>
                        </Flex>
                    </Col>
                </Row>
            </ListGroupItem>
        </LinkContainer>
    );
};

const mapStateToProps = (state, props) => ({
    entry: get(state, `subtraction.documents[${props.index}]`, null)
});

export default connect(mapStateToProps)(SubtractionItem);
