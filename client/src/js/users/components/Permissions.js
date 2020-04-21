import { connect } from "react-redux";
import { transform } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import styled from "styled-components";
import { PermissionItem } from "./Permission";

const UserPermissionsHeader = styled.div`
    align-items: center;
    display: flex;

    small {
        color: ${props => props.theme.color.greyDarkest};
        font-size: ${props => props.theme.fontSize.sm};
        margin-left: auto;
    }
`;
export const UserPermissions = ({ permissions }) => {
    const permissionComponents = transform(
        permissions,
        (acc, value, permission) => acc.push(<PermissionItem key={permission} permission={permission} value={value} />),
        []
    );

    return (
        <div>
            <UserPermissionsHeader>
                <label>Permissions</label>
                <small>Change group membership to modify permissions</small>
            </UserPermissionsHeader>
            {permissionComponents}
        </div>
    );
};

UserPermissions.propTypes = {
    permissions: PropTypes.object
};
export const mapStateToProps = state => ({
    permissions: state.users.detail.permissions
});
export default connect(mapStateToProps)(UserPermissions);
