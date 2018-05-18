import React from "react";
import { map } from "lodash-es";
import { Badge, Panel, ListGroup, ListGroupItem, Table } from "react-bootstrap";
import { connect } from "react-redux";
import { Link } from "react-router-dom";


import { Flex, FlexItem, RelativeTime } from "../../base";

const PanelBadgeHeader = ({ title, count }) => (
    <Flex alignItems="center">
        <FlexItem>
            {title}
        </FlexItem>
        <FlexItem pad>
            <Badge>{count}</Badge>
        </FlexItem>
    </Flex>
);

const IndexOTUEntry = ({ refId, changeCount, id, name}) => (
    <ListGroupItem>
        <Link to={`/refs/${refId}/otus/${id}`}>
            {name}
        </Link>
        <Badge>
            {changeCount} {`change${changeCount > 1 ? "s" : ""}`}
        </Badge>
    </ListGroupItem>
);

const IndexGeneral = ({ detail }) => {

    const refId = detail.reference.id;

    const contributors = map(detail.contributors, contributor =>
        <ListGroupItem key={contributor.id}>
            {contributor.id} <Badge>{contributor.count} {`change${contributor.count > 1 ? "s" : ""}`}</Badge>
        </ListGroupItem>
    );

    const otus = map(detail.otus, otu =>
        <IndexOTUEntry
            key={otu.id}
            refId={refId}
            name={otu.name}
            id={otu.id}
            changeCount={otu.change_count}
        />
    );

    return (
        <div>
            <Table bordered>
                <tbody>
                    <tr>
                        <th className="col-xs-4">Change Count</th>
                        <td className="col-xs-8">{detail.change_count}</td>
                    </tr>
                    <tr>
                        <th>Created</th>
                        <td><RelativeTime time={detail.created_at} /></td>
                    </tr>
                    <tr>
                        <th>Created By</th>
                        <td>{detail.user.id}</td>
                    </tr>
                    <tr>
                        <th>Unique ID</th>
                        <td>{detail.id}</td>
                    </tr>
                </tbody>
            </Table>

            <Panel>
                <Panel.Heading>
                    <PanelBadgeHeader title="Contributors" count={contributors.length} />
                </Panel.Heading>
                <Panel.Body>
                    <ListGroup>
                        {contributors}
                    </ListGroup>
                </Panel.Body>
            </Panel>

            <Panel>
                <Panel.Heading>
                    <PanelBadgeHeader title="OTUs" count={otus.length} />
                </Panel.Heading>
                <Panel.Body>
                    <ListGroup>
                        {otus}
                    </ListGroup>
                </Panel.Body>
            </Panel>
        </div>
    );
};

const mapStateToProps = (state) => ({
    detail: state.indexes.detail
});

export default connect(mapStateToProps)(IndexGeneral);
