import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { SpacedBox, device } from "../../../base";
import { getReferenceItemProgress } from "../../selectors";
import { ReferenceItemBuild } from "./Build";
import { ReferenceItemHeader } from "./Header";
import { ReferenceItemOrigin } from "./Origin";
import { ReferenceItemProgress } from "./Progress";

const ReferenceItemBody = styled.div`
    align-items: stretch;
    display: grid;
    grid-template-columns: 1fr;
    grid-column-gap: ${props => props.theme.gap.column};
    margin-bottom: 5px;
    padding: 0 15px 5px;

    @media (min-width: ${device.desktop}) {
        grid-template-columns: 1fr 1fr;
    }
`;

const StyledReferenceItem = styled(SpacedBox)`
    padding: 0 0 10px;
    margin-bottom: 15px;
`;

export const ReferenceItem = ({
    clonedFrom,
    createdAt,
    dataType,
    id,
    importedFrom,
    latestBuild,
    name,
    organism,
    otuCount,
    progress,
    remotesFrom,
    userId
}) => {
    return (
        <StyledReferenceItem>
            <ReferenceItemHeader
                id={id}
                createdAt={createdAt}
                dataType={dataType}
                name={name}
                organism={organism}
                otuCount={otuCount}
                userId={userId}
            />
            <ReferenceItemBody>
                <ReferenceItemOrigin clonedFrom={clonedFrom} importedFrom={importedFrom} remotesFrom={remotesFrom} />
                <ReferenceItemBuild id={id} latestBuild={latestBuild} progress={progress} />
            </ReferenceItemBody>
            <ReferenceItemProgress now={progress} />
        </StyledReferenceItem>
    );
};

export const mapStateToProps = (state, ownProps) => {
    const {
        cloned_from,
        created_at,
        data_type,
        id,
        imported_from,
        latest_build,
        name,
        organism,
        otu_count,
        remotes_from,
        user
    } = state.references.documents[ownProps.index];

    const progress = getReferenceItemProgress(state, ownProps.index);

    return {
        id,
        name,
        organism,
        progress,
        clonedFrom: cloned_from,
        createdAt: created_at,
        dataType: data_type,
        importedFrom: imported_from,
        latestBuild: latest_build,
        otuCount: otu_count,
        remotesFrom: remotes_from,
        userId: user.id
    };
};

export default connect(mapStateToProps)(ReferenceItem);
