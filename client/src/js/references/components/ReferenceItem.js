import React from "react";
import { LinkContainer } from "react-router-bootstrap";
import { FlexItem, RelativeTime, Button } from "../../base";
import { Panel, Table, Row, Badge } from "react-bootstrap";

const ReferenceHeader = ({ name, createdAt, user }) => (
    <div style={{ marginLeft: "5px" }}>
        <Row>
            <strong>{name}</strong><Badge style={{ margin: "5px" }}>count</Badge>
        </Row>
        <Row>
            <small>
                Created <RelativeTime time={createdAt} /> by {user}
            </small>
        </Row>
    </div>
);

const ReferenceMetadata = ({ dataType, organism, isPublic }) => (
    <Table bordered>
        <tbody>
            <tr>
                <th>Data Type</th>
                <td className="text-capitalize">
                    { dataType }
                </td>
            </tr>
            <tr>
                <th>Organism</th>
                <td className="text-capitalize">
                    { organism || "unknown" }
                </td>
            </tr>
            <tr>
                <th>Public</th>
                <td>{`${isPublic}`}</td>
            </tr>
        </tbody>
    </Table>
);

const ReferenceFooter = ({ id }) => (
    <div style={{ margin: "0 5px" }}>
        <Row>
            <Button>
                View Kinds
            </Button>
            <LinkContainer to={`/refs/${id}`} key={id} className="spaced">
                <Button icon="edit" pullRight>
                    Manage
                </Button>
            </LinkContainer>
        </Row>
    </div>
);

const ReferenceItem = (props) => (
    <FlexItem
        alignSelf="auto"
        grow={0}
        shrink={0}
        basis="auto"
        style={{ margin: "1rem 1rem 0 0", minWidth: "300px" }}
    >
        <Panel>
            <Panel.Heading>
                <ReferenceHeader name={props.name} createdAt={props.created_at} user={props.user.id} />
            </Panel.Heading>
            <ReferenceMetadata
                dataType={props.data_type}
                build={props.latest_build}
                organism={props.organism}
                isPublic={props.public}
            />
            <Panel.Footer>
                <ReferenceFooter id={props.id} />
            </Panel.Footer>
        </Panel>
    </FlexItem>
);

export default ReferenceItem;
