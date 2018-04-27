import React from "react";
import { LinkContainer } from "react-router-bootstrap";
import { FlexItem, RelativeTime, Button } from "../../base";
import { Panel, Table, Col, Row, Badge } from "react-bootstrap";

const ReferenceHeader = ({ name }) => (
    <div style={{ marginLeft: "5px" }}>
        <Row>
            <strong>{name}</strong><Badge style={{ margin: "5px" }}>1024</Badge>
        </Row>
        <Row>
            Created <RelativeTime time="2018-04-27T20:11:21.977000Z" /> by USER
        </Row>
    </div>
);

const ReferenceMetadata = () => (
    <Table bordered>
        <tbody>
            <tr>
                <th>Unbuilt Changes</th>
                <td>yes / no</td>
            </tr>
            <tr>
                <th>Datatype</th>
                <td>datatype</td>
            </tr>
            <tr>
                <th>Organism</th>
                <td>organism</td>
            </tr>
        </tbody>
    </Table>
);

const ReferenceFooter = () => (
    <div style={{ margin: "0 5px" }}>
        <Row>
            <Button>
                View Kinds
            </Button>
            <Button pullRight>
                Manage
            </Button>
        </Row>
    </div>
);

const ReferenceItem = ({ id, name }) => (
    <FlexItem alignSelf="auto" grow={1} style={{ margin: "10px" }}>
        <LinkContainer to={`/refs/${id}`} key={id} className="spaced">
            <Panel>
                <Panel.Heading>
                    <ReferenceHeader name={name} />
                </Panel.Heading>
                <Panel.Body>
                    <ReferenceMetadata />
                </Panel.Body>
                <Panel.Footer>
                    <ReferenceFooter />
                </Panel.Footer>
            </Panel>
        </LinkContainer>
    </FlexItem>
);

export default ReferenceItem;
