import React from "react";
import styled from "styled-components";
import { connect } from "react-redux";
import { BoxGroup, ProgressBar, Table } from "../../../base";
import { getReferenceItemProgress } from "../../selectors";
import { ReferenceItemHeader } from "./Header";
import { ReferenceItemOrigin } from "./Origin";
import { ReferenceItemBuild } from "./Build";

const ReferenceItemTable = styled(Table)`
    tr {
        td,
        th {
            min-width: 70px;
        }

        &:first-child {
            border-top: 1px solid #dddddd;
        }
    }
`;

const StyledReferenceItem = styled(BoxGroup)`
    box-shadow: 1px 1px 2px 0 #d5d5d5;
    display: flex;
    flex-direction: column;
    justify-content: space-between;

    .progress {
        flex: 0 0 auto;
        width: 100%;
        height: 5px;
    }

    table {
        margin-bottom: 0;
    }

    th {
        padding-left: 15px !important;
    }
`;

export const ReferenceItem = ({
    clonedFrom,
    createdAt,
    id,
    importedFrom,
    latestBuild,
    name,
    organism,
    progress,
    remotesFrom,
    userId
}) => {
    return (
        <StyledReferenceItem>
            <ReferenceItemHeader id={id} createdAt={createdAt} name={name} userId={userId} />
            <ReferenceItemTable>
                <tbody>
                    <tr>
                        <th>Organism</th>
                        <td className="text-capitalize">{organism || "unknown"}</td>
                    </tr>
                    <ReferenceItemOrigin
                        clonedFrom={clonedFrom}
                        importedFrom={importedFrom}
                        remotesFrom={remotesFrom}
                    />
                    <ReferenceItemBuild id={id} latestBuild={latestBuild} progress={progress} />
                </tbody>
            </ReferenceItemTable>
            <ProgressBar bsStyle={progress === 100 ? "success" : "warning"} now={progress} affixed />
        </StyledReferenceItem>
    );
};

export const mapStateToProps = (state, ownProps) => {
    const {
        cloned_from,
        created_at,
        id,
        imported_from,
        latest_build,
        name,
        organism,
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
        importedFrom: imported_from,
        latestBuild: latest_build,
        remotesFrom: remotes_from,
        userId: user.id
    };
};

export default connect(mapStateToProps)(ReferenceItem);
