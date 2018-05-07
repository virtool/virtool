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

const IndexOTUEntry = ({ changeCount, id, name}) => (
    <ListGroupItem>
        <Link to={`/OTUs/${id}`}>
            {name}
        </Link>
        <Badge>
            {changeCount} {`change${changeCount > 1 ? "s" : ""}`}
        </Badge>
    </ListGroupItem>
);

const IndexGeneral = ({ detail }) => {

    const contributors = map(detail.contributors, contributor =>
        <ListGroupItem key={contributor.id}>
            {contributor.id} <Badge>{contributor.count} {`change${contributor.count > 1 ? "s" : ""}`}</Badge>
        </ListGroupItem>
    );

    const OTUs = map(detail.OTUs, OTU =>
        <IndexOTUEntry
            key={OTU.id}
            name={OTU.name}
            id={OTU.id}
            changeCount={OTU.change_count}
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
                    <PanelBadgeHeader title="OTUs" count={OTUs.length} />
                </Panel.Heading>
                <Panel.Body>
                    <ListGroup>
                        {OTUs}
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
