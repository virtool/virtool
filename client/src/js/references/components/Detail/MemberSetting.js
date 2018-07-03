import React from "react";
import { Row, Col, Panel } from "react-bootstrap";
import { capitalize } from "lodash-es";
import { Flex, FlexItem, Icon } from "../../../base";

const MemberSetting = (props) => (
    <React.Fragment>
        <Row>
            <Col xs={6} md={6}>
                <Flex alignItems="center">
                    <FlexItem grow={1} >
                        <h5><strong>{capitalize(props.noun)}</strong></h5>
                    </FlexItem>
                    <FlexItem>
                        <Icon
                            name="plus-square"
                            bsStyle="primary"
                            tip="Add Member"
                            onClick={props.onAdd}
                        />
                    </FlexItem>
                </Flex>
            </Col>

            <Col smHidden md={6} />
        </Row>
        <Row>
            <Col xs={12} md={6} mdPush={6}>
                <Panel>
                    <Panel.Body>
                        Edit permissions for, add, or remove individual {props.noun} that can access this reference.
                    </Panel.Body>
                </Panel>
            </Col>
            <Col xs={12} md={6} mdPull={6}>
                <Panel>
                    <Panel.Body>
                        {props.listComponents}
                    </Panel.Body>
                </Panel>
            </Col>
            <Col smHidden md={6} />
        </Row>
    </React.Fragment>
);

export default MemberSetting;
