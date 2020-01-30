import React from "react";
import { connect } from "react-redux";

import { BoxGroup, BoxGroupHeader, Table } from "../../../base";
import { Contributors } from "../../../indexes/components/Contributors";
import { checkUpdates, updateRemoteReference } from "../../actions";
import ReferenceDetailHeader from "./Header";
import RemoteReference from "./Remote";
import ReferenceDetailTabs from "./Tabs";
import Targets from "./Targets/Targets";
import { Clone } from "./Clone";
import { LatestBuild } from "./LatestBuild";

export const ReferenceManage = props => {
    let remote;
    let clone;

    if (props.remotes_from) {
        remote = <RemoteReference />;
    }

    if (props.cloned_from) {
        clone = <Clone source={props.cloned_from} />;
    }

    return (
        <div>
            <ReferenceDetailHeader />
            <ReferenceDetailTabs />

            <Table>
                <tbody>
                    <tr>
                        <th>Description</th>
                        <td>{props.description}</td>
                    </tr>
                    <tr>
                        <th>Organism</th>
                        <td className="text-capitalize">{props.organism}</td>
                    </tr>
                    <tr>
                        <th>DataType</th>
                        <td className="text-capitalize">{props.data_type}</td>
                    </tr>
                </tbody>
            </Table>

            {remote}
            {clone}

            <BoxGroup>
                <BoxGroupHeader>
                    <h2>Latest Index Build</h2>
                </BoxGroupHeader>
                <LatestBuild id={props.id} latestBuild={props.latest_build} />
            </BoxGroup>

            <Contributors contributors={props.contributors} />
            <Targets />
        </div>
    );
};

export const mapStateToProps = state => ({
    id: state.references.detail.id,
    cloned_from: state.references.detail.cloned_from,
    contributors: state.references.detail.contributors,
    description: state.references.detail.description,
    latest_build: state.references.detail.latest_build,
    organism: state.references.detail.organism,
    remotes_from: state.references.detail.remotes_from,
    data_type: state.references.detail.data_type
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
