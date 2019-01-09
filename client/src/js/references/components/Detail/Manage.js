import { map, sortBy } from "lodash-es";
import React from "react";
import { Badge, ListGroup, Panel, Table } from "react-bootstrap";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { ListGroupItem, NoneFound, RelativeTime } from "../../../base";
import { checkUpdates, updateRemoteReference } from "../../actions";
import RemoteReference from "./Remote";

const Clone = ({ source }) => (
    <Panel>
        <Panel.Heading>Clone Reference</Panel.Heading>
        <ListGroup>
            <ListGroupItem>
                <strong>Source Reference</strong>
                <span>
                    {" / "}
                    <a href={`/refs/${source.id}`}>{source.name}</a>
                </span>
            </ListGroupItem>
        </ListGroup>
    </Panel>
);

const Contributors = ({ contributors }) => {
    if (contributors.length) {
        const sorted = sortBy(contributors, ["id", "count"]);

        const contributorComponents = map(sorted, entry => (
            <ListGroupItem key={entry.id}>
                {entry.id} <Badge>{entry.count}</Badge>
            </ListGroupItem>
        ));

        return <ListGroup>{contributorComponents}</ListGroup>;
    }

    return <NoneFound noun="contributors" />;
};

const LatestBuild = ({ id, latestBuild }) => {
    if (latestBuild) {
        return (
            <ListGroupItem>
                <strong>
                    <Link to={`/refs/${id}/indexes/${latestBuild.id}`}>Index {latestBuild.version}</Link>
                </strong>
                <span>
                    &nbsp;/ Created <RelativeTime time={latestBuild.created_at} /> by {latestBuild.user.id}
                </span>
            </ListGroupItem>
        );
    }

    return <NoneFound noun="builds" noListGroup />;
};

const ReferenceManage = ({ canRemove, detail }) => {
    const {
        id,
        cloned_from,
        contributors,
        data_type,
        description,
        internal_control,
        latest_build,
        organism,
        remotes_from
    } = detail;

    let remote;
    let clone;

    if (remotes_from) {
        remote = <RemoteReference />;
    }

    if (cloned_from) {
        clone = <Clone source={cloned_from} />;
    }

    return (
        <div>
            <Table bordered>
                <tbody>
                    <tr>
                        <th className="col-xs-4">Description</th>
                        <td className="col-xs-8">{description}</td>
                    </tr>
                    <tr>
                        <th>Data Type</th>
                        <td>{data_type}</td>
                    </tr>
                    <tr>
                        <th>Organism</th>
                        <td>{organism}</td>
                    </tr>
                    <tr>
                        <th>Internal Control</th>
                        <td>{internal_control ? internal_control.name : null}</td>
                    </tr>
                </tbody>
            </Table>

            {remote}
            {clone}

            <Panel>
                <Panel.Heading>Latest Index Build</Panel.Heading>

                <ListGroup>
                    <LatestBuild refId={id} latestBuild={latest_build} />
                </ListGroup>
            </Panel>

            <Panel>
                <Panel.Heading>Contributors</Panel.Heading>
                <Contributors contributors={contributors} />
            </Panel>
        </div>
    );
};

const mapStateToProps = state => ({
    detail: state.references.detail
});

const mapDispatchToProps = dispatch => ({
    onCheckUpdates: refId => {
        dispatch(checkUpdates(refId));
    },

    onUpdate: refId => {
        dispatch(updateRemoteReference(refId));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ReferenceManage);
