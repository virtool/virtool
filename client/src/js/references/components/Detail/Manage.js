import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";

import { BoxGroup, BoxGroupHeader, NarrowContainer, Table } from "../../../base";
import { Contributors } from "../../../indexes/components/Contributors";
import { checkUpdates, updateRemoteReference } from "../../actions";
import { Clone } from "./Clone";
import ReferenceExport from "./Export";
import { LatestBuild } from "./LatestBuild";
import RemoteReference from "./Remote";
import Targets from "./Targets/Targets";

const ReferenceManageTable = styled(Table)`
    th {
        width: 180px;
    }

    tr:not(:first-of-type) td {
        text-transform: capitalize;
    }
`;

export const ReferenceManage = ({
    clonedFrom,
    contributors,
    dataType,
    description,
    id,
    latestBuild,
    organism,
    remotesFrom
}) => (
    <NarrowContainer>
        <BoxGroup>
            <BoxGroupHeader>
                <h2>General</h2>
            </BoxGroupHeader>
            <ReferenceManageTable>
                <tbody>
                    <tr>
                        <th>Description</th>
                        <td>{description}</td>
                    </tr>
                    <tr>
                        <th>Organism</th>
                        <td>{organism}</td>
                    </tr>
                    <tr>
                        <th>Data Type</th>
                        <td>{dataType}</td>
                    </tr>
                </tbody>
            </ReferenceManageTable>
        </BoxGroup>

        {remotesFrom && <RemoteReference />}
        {clonedFrom && <Clone source={clonedFrom} />}

        <BoxGroup>
            <BoxGroupHeader>
                <h2>Latest Index Build</h2>
            </BoxGroupHeader>
            <LatestBuild id={id} latestBuild={latestBuild} />
        </BoxGroup>

        <Contributors contributors={contributors} />
        <Targets />
        <ReferenceExport />
    </NarrowContainer>
);

export const mapStateToProps = state => ({
    id: state.references.detail.id,
    clonedFrom: state.references.detail.cloned_from,
    contributors: state.references.detail.contributors,
    description: state.references.detail.description,
    latestBuild: state.references.detail.latest_build,
    organism: state.references.detail.organism,
    remotesFrom: state.references.detail.remotes_from,
    dataType: state.references.detail.data_type
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
