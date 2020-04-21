import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";

import { BoxGroup, BoxGroupHeader, Table } from "../../../base";
import { Contributors } from "../../../indexes/components/Contributors";
import { checkUpdates, updateRemoteReference } from "../../actions";
import { Clone } from "./Clone";
import ReferenceDetailHeader from "./Header";
import { LatestBuild } from "./LatestBuild";
import RemoteReference from "./Remote";
import ReferenceDetailTabs from "./Tabs";
import Targets from "./Targets/Targets";

const ReferenceManageTable = styled(Table)`
    tr:not(:first-of-type) td {
        text-transform: capitalize;
    }
`;

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
            <ReferenceManageTable>
                <tbody>
                    <tr>
                        <th>Description</th>
                        <td>{props.description}</td>
                    </tr>
                    <tr>
                        <th>Organism</th>
                        <td>{props.organism}</td>
                    </tr>
                    <tr>
                        <th>Data Type</th>
                        <td>{props.data_type}</td>
                    </tr>
                </tbody>
            </ReferenceManageTable>

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
