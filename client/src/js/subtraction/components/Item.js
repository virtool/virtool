import React from "react";
import { ClipLoader } from "halogenium";
import { LinkContainer } from "react-router-bootstrap";
import { Col, Row } from "react-bootstrap";

import { Flex, FlexItem, Icon, ListGroupItem } from "../../base";

export default function SubtractionItem ({ id, description, ready }) {

    let icon;

    if (ready) {
        icon = <Icon name="check" bsStyle="success" />;
    } else {
        icon = <ClipLoader size="14px" color="#3c8786" />;
    }

    return (
        <LinkContainer key={id} className="spaced" to={`/subtraction/${id}`}>
            <ListGroupItem>
                <Row>
                    <Col xs={8} md={4}>
                        <strong>{id}</strong>
                    </Col>
                    <Col xsHidden smHidden md={3} className="text-muted">
                        {description}
                    </Col>
                    <Col xs={4} md={5}>
                        <Flex alignItems="center" className="pull-right">
                            {icon}
                            <FlexItem pad>
                                <strong>{ready ? "Ready" : "Importing"}</strong>
                            </FlexItem>
                        </Flex>
                    </Col>
                </Row>
            </ListGroupItem>
        </LinkContainer>
    );
}
