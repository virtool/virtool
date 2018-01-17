import React from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { Badge, Panel, ListGroup, ListGroupItem, Table } from "react-bootstrap";

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

const IndexVirusEntry = ({ changeCount, id, name}) => (
    <ListGroupItem>
        <Link to={`/viruses/${id}`}>
            {name}
        </Link>
        <Badge>
            {changeCount} {`change${changeCount > 1 ? "s" : ""}`}
        </Badge>
    </ListGroupItem>
);

const IndexGeneral = ({ detail }) => {

    const contributors = detail.contributors.map(contributor =>
        <ListGroupItem key={contributor.id}>
            {contributor.id} <Badge>{contributor.count} {`change${contributor.count > 1 ? "s" : ""}`}</Badge>
        </ListGroupItem>
    );

    const viruses = detail.viruses.map(virus =>
        <IndexVirusEntry
            key={virus.id}
            name={virus.name}
            id={virus.id}
            changeCount={virus.change_count}
        />
    );

    return (
        <div>
            <Table bordered>
                <tbody>
                    <tr>
                        <th>Change Count</th>
                        <td>{detail.change_count}</td>
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

            <Panel header={<PanelBadgeHeader title="Contributors" count={contributors.length} />}>
                <ListGroup fill>
                    {contributors}
                </ListGroup>
            </Panel>

            <Panel header={<PanelBadgeHeader title="Viruses" count={viruses.length} />}>
                <ListGroup fill>
                    {viruses}
                </ListGroup>
            </Panel>
        </div>
    );
};

const mapStateToProps = (state) => ({
    detail: state.indexes.detail
});

const Container = connect(mapStateToProps)(IndexGeneral);

export default Container;
