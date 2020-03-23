import { endsWith } from "lodash-es";
import React, { useCallback } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { pushState } from "../../../app/actions";
import {
    DropdownIcon,
    DropdownItem,
    Icon,
    ViewHeader,
    ViewHeaderAttribution,
    ViewHeaderIcons,
    ViewHeaderTitle
} from "../../../base";
import { checkRefRight, followDownload } from "../../../utils/utils";

const ExportDropdownItem = styled.div`
    width: 220px;

    &:first-of-type {
        margin-top: 5px;
    }

    h5 {
        font-size: 14px !important;
        font-weight: bold;
        margin: 0 0 5px;
    }

    p {
        color: ${props => props.theme.color.greyDark};
        font-size: 12px;
        line-height: 16px;
        margin: 0;
    }
`;

export const ReferenceDetailHeaderExportButton = ({ isClone, onSelect }) => {
    let remoteMenuItem;

    if (isClone) {
        remoteMenuItem = (
            <DropdownItem onClick={() => onSelect("remote")}>
                <ExportDropdownItem>
                    <h5>Source</h5>
                    <p>Export the reference using the OTU IDs from the source reference for this clone.</p>
                </ExportDropdownItem>
            </DropdownItem>
        );
    }

    return (
        <DropdownIcon name="download" tip="Export">
            <DropdownItem onClick={() => onSelect("normal")}>
                <ExportDropdownItem>
                    <h5>Normal</h5>
                    <p>Export the reference with the local OTU IDs.</p>
                </ExportDropdownItem>
            </DropdownItem>
            {remoteMenuItem}
        </DropdownIcon>
    );
};

export const ReferenceDetailHeaderIcon = ({ canModify, isRemote, onEdit }) => {
    if (isRemote) {
        return <Icon color="grey" name="lock" />;
    }

    if (canModify) {
        return <Icon color="orange" name="pencil-alt" tip="Edit" onClick={onEdit} />;
    }

    return null;
};

export const ReferenceDetailHeader = ({
    canModify,
    createdAt,
    id,
    isClone,
    isRemote,
    name,
    showIcons,
    userId,
    onEdit
}) => {
    const handleSelect = useCallback(key => followDownload(`/download/refs/${id}?scope=${key}`), [id]);

    let headerIcon;
    let exportButton;

    if (showIcons) {
        headerIcon = <ReferenceDetailHeaderIcon canModify={canModify} isRemote={isRemote} onEdit={onEdit} />;
        exportButton = <ReferenceDetailHeaderExportButton isClone={isClone} onSelect={handleSelect} />;
    }

    return (
        <ViewHeader title={name}>
            <ViewHeaderTitle>
                {name}
                <ViewHeaderIcons>
                    {headerIcon}
                    {exportButton}
                </ViewHeaderIcons>
            </ViewHeaderTitle>
            <ViewHeaderAttribution time={createdAt} user={userId} />
        </ViewHeader>
    );
};

export const mapStateToProps = state => {
    const { name, id, cloned_from, remotes_from, created_at, user } = state.references.detail;
    return {
        id,
        name,
        // Must have permissions to modify. It is not possible to modify remote references.
        canModify: checkRefRight(state, "modify"),
        createdAt: created_at,
        isClone: !!cloned_from,
        isRemote: !!remotes_from,
        showIcons: endsWith(state.router.location.pathname, "/manage"),
        userId: user.id
    };
};

export const mapDispatchToProps = dispatch => ({
    onEdit: () => {
        dispatch(pushState({ editReference: true }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(ReferenceDetailHeader);
