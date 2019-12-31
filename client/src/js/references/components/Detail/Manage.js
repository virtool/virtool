import React from "react";
import { ListGroup } from "react-bootstrap";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import {
    BoxGroup,
    BoxGroupHeader,
    BoxGroupSection,
    ListGroupItem,
    NoneFoundSection,
    Panel,
    RelativeTime,
    Table
} from "../../../base";
import { Contributors } from "../../../indexes/components/Contributors";
import { checkUpdates, updateRemoteReference } from "../../actions";
import ReferenceDetailHeader from "./Header";
import RemoteReference from "./Remote";
import ReferenceDetailTabs from "./Tabs";

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

const LatestBuild = ({ id, latestBuild }) => {
    if (latestBuild) {
        return (
            <BoxGroupSection>
                <strong>
                    <Link to={`/refs/${id}/indexes/${latestBuild.id}`}>Index {latestBuild.version}</Link>
                </strong>
                <span>
                    &nbsp;/ Created <RelativeTime time={latestBuild.created_at} /> by {latestBuild.user.id}
                </span>
            </BoxGroupSection>
        );
    }

    return <NoneFoundSection noun="index builds" />;
};

const ReferenceManage = ({ detail }) => {
    const { id, cloned_from, contributors, description, latest_build, organism, remotes_from } = detail;

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
            <ReferenceDetailHeader />
            <ReferenceDetailTabs />

            <Table>
                <tbody>
                    <tr>
                        <th>Description</th>
                        <td>{description}</td>
                    </tr>
                    <tr>
                        <th>Organism</th>
                        <td className="text-capitalize">{organism}</td>
                    </tr>
                </tbody>
            </Table>

            {remote}
            {clone}

            <BoxGroup>
                <BoxGroupHeader>
                    <h2>Latest Index Build</h2>
                </BoxGroupHeader>
                <LatestBuild refId={id} latestBuild={latest_build} />
            </BoxGroup>

            <Contributors contributors={contributors} />
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

export default connect(mapStateToProps, mapDispatchToProps)(ReferenceManage);
