import React from "react";
import { Row, Col, Panel } from "react-bootstrap";
import { Flex, FlexItem } from "../../base";

const AdministrationSection = props => (
    <Row>
        <Col md={12}>
            {props.extraIcon ? (
                <Row>
                    <Col xs={12} md={6}>
                        <Flex alignItems="center">
                            <FlexItem grow={1}>
                                <h5>
                                    <strong>{props.title}</strong>
                                </h5>
                            </FlexItem>
                            <FlexItem>{props.extraIcon}</FlexItem>
                        </Flex>
                    </Col>
                    <Col smHidden md={8} />
                </Row>
            ) : (
                <h5>
                    <strong>{props.title}</strong>
                </h5>
            )}
        </Col>
        <Col xs={12} md={6} mdPush={6}>
            <Panel>
                <Panel.Body>{props.description}</Panel.Body>
                {props.footerComponent ? <Panel.Footer>{props.footerComponent}</Panel.Footer> : null}
            </Panel>
        </Col>
        <Col xs={12} md={6} mdPull={6}>
            <Panel>{props.content}</Panel>
        </Col>
    </Row>
);

export default AdministrationSection;
