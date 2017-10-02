/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import React from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { Badge, Panel, ListGroup, ListGroupItem, Table } from "react-bootstrap";

import { Flex, FlexItem, RelativeTime } from "virtool/js/components/Base";

const IndexGeneral = (props) => {

    const contributors = props.detail.contributors.map(contributor =>
        <ListGroupItem key={contributor.id}>
            {contributor.id} <Badge>{contributor.count} {`change${contributor.count > 1 ? "s": ""}`}</Badge>
        </ListGroupItem>
    );

    const viruses = props.detail.viruses.map(virus =>
        <ListGroupItem key={virus.id}>
            <Link to={`/viruses/${virus.id}`}>
                {virus.name}
            </Link>
            <Badge>
                {virus.change_count} {`change${virus.change_count > 1 ? "s": ""}`}
            </Badge>
        </ListGroupItem>
    );

    const contributorsHeader = (
        <Flex alignItems="center">
            <FlexItem>
                Contributors
            </FlexItem>
            <FlexItem pad>
                <Badge>{contributors.length}</Badge>
            </FlexItem>
        </Flex>
    );

    const virusesHeader = (
        <Flex alignItems="center">
            <FlexItem>
                Viruses
            </FlexItem>
            <FlexItem pad>
                <Badge>{viruses.length}</Badge>
            </FlexItem>
        </Flex>
    );

    return (
        <div>
            <Table bordered>
                <tbody>
                    <tr>
                        <th>Change Count</th>
                        <td>{props.detail.change_count}</td>
                    </tr>
                    <tr>
                        <th>Created</th>
                        <td><RelativeTime time={props.detail.created_at} /></td>
                    </tr>
                    <tr>
                        <th>Created By</th>
                        <td>{props.detail.user.id}</td>
                    </tr>
                    <tr>
                        <th>Unique ID</th>
                        <td>{props.detail.id}</td>
                    </tr>
                </tbody>
            </Table>

            <Panel header={contributorsHeader}>
                <ListGroup fill>
                    {contributors}
                </ListGroup>
            </Panel>

            <Panel header={virusesHeader}>
                <ListGroup fill>
                    {viruses}
                </ListGroup>
            </Panel>
        </div>
    );
};

const mapStateToProps = (state) => {
    return {
        detail: state.indexes.detail
    };
};

const Container = connect(mapStateToProps)(IndexGeneral);

export default Container;
