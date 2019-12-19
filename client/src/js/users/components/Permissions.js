/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports GroupsPermissions
 */
import { connect } from "react-redux";
import { transform } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import styled from "styled-components";
import { PermissionItem } from "./Permission";

const StyledPermissions = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
`;
export class UserPermissions extends React.Component {
    render() {
        const permissionComponents = transform(
            this.props.permissions,
            (acc, value, permission) =>
                acc.push(<PermissionItem key={permission} permission={permission} value={value} />),
            []
        );

        return (
            <div>
                <StyledPermissions>
                    <label>Permissions</label>
                    <small className="text-muted">Change group membership to modify permissions</small>
                </StyledPermissions>
                {permissionComponents}
            </div>
        );
    }
}

UserPermissions.propTypes = {
    permissions: PropTypes.object
};
export const mapStateToProps = state => ({
    permissions: state.users.detail.permissions
});
export default connect(mapStateToProps)(UserPermissions);
