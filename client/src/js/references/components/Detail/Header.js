import { endsWith } from "lodash-es";
import React, { useCallback } from "react";
import styled from "styled-components";
import { Dropdown, MenuItem } from "react-bootstrap";
import { connect } from "react-redux";
import { pushState } from "../../../app/actions";
import { Flex, FlexItem, Icon, RelativeTime, ViewHeader } from "../../../base";
import { checkRefRight, followDownload } from "../../../utils/utils";

class CustomToggle extends React.Component {
    render() {
        return (
            <Icon
                name="download"
                tip="Options"
                onClick={this.props.onClick}
                style={{ fontSize: "65%", paddingLeft: "5px" }}
            />
        );
    }
}

const ExportDropdown = styled(Dropdown)`
    display: inline;
    line-height: 0.5;

    .dropdown-menu {
        right: 0;
        left: auto;
        min-width: auto;
    }
`;

export const ReferenceDetailHeaderExportButton = ({ isClone, onSelect }) => {
    let remoteMenuItem;

    if (isClone) {
        remoteMenuItem = (
            <MenuItem eventKey="remote" onSelect={onSelect}>
                <div>Remote</div>
                <small>Export the reference using the OTU IDs from the source reference for this clone.</small>
            </MenuItem>
        );
    }

    return (
        <ExportDropdown id="dropdown-export-reference">
            <CustomToggle bsRole="toggle" />
            <Dropdown.Menu>
                <MenuItem eventKey="built" onSelect={onSelect}>
                    <div>Normal</div>
                    <small>Export the reference with the local OTU IDs.</small>
                </MenuItem>
                {remoteMenuItem}
            </Dropdown.Menu>
        </ExportDropdown>
    );
};

export const ReferenceDetailHeaderIcon = ({ canModify, isRemote, onEdit }) => {
    if (isRemote) {
        return <Icon bsStyle="default" name="lock" style={{ fontSize: "65%" }} pullRight />;
    }

    if (canModify) {
        return (
            <Icon
                bsStyle="warning"
                name="pencil-alt"
                tip="Edit"
                onClick={onEdit}
                pullRight
                style={{ fontSize: "65%" }}
            />
        );
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
        <ViewHeader title={`${name} - References`}>
            <Flex alignItems="flex-end">
                <FlexItem grow={1}>
                    <Flex>
                        <strong>{name}</strong>
                    </Flex>
                </FlexItem>
                {headerIcon}
                {exportButton}
            </Flex>
            <div className="text-muted" style={{ fontSize: "12px" }}>
                Created <RelativeTime time={createdAt} /> by {userId}
            </div>
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
