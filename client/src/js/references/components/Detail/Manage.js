import React from "react";

import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { BoxGroup, BoxGroupHeader, BoxGroupSection, NoneFoundSection, RelativeTime, Table } from "../../../base";
import { Contributors } from "../../../indexes/components/Contributors";
import { checkUpdates, updateRemoteReference } from "../../actions";
import ReferenceDetailHeader from "./Header";
import RemoteReference from "./Remote";
import ReferenceDetailTabs from "./Tabs";

const Clone = ({ source }) => (
    <BoxGroup>
        <BoxGroupHeader>
            <h2>Clone Reference</h2>
        </BoxGroupHeader>

        <BoxGroupSection>
            <strong>Source Reference</strong>
            <span>
                {" / "}
                <a href={`/refs/${source.id}`}>{source.name}</a>
            </span>
        </BoxGroupSection>
    </BoxGroup>
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

export const ReferenceManage = ({ detail }) => {
    const { id, cloned_from, contributors, description, latest_build, organism, remotes_from, data_type } = detail;

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
                    <tr>
                        <th>DataType</th>
                        <td className="text-capitalize">{data_type}</td>
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

export const mapStateToProps = state => ({
    detail: state.references.detail
});

export const mapDispatchToProps = dispatch => ({
    onCheckUpdates: refId => {
        dispatch(checkUpdates(refId));
    },

    onUpdate: refId => {
        dispatch(updateRemoteReference(refId));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(ReferenceManage);
