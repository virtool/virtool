import { map, sortBy } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import styled from "styled-components";
import { connect } from "react-redux";
import { BoxGroup, BoxGroupSection, Checkbox } from "../../../base";

export const APIPermissionName = styled(BoxGroupSection)`
    display: flex;
    justify-content: space-between;
`;

export const APIPermissions = ({ administrator, className, userPermissions, keyPermissions, onChange }) => {
    const permissions = map(keyPermissions, (value, key) => ({
        name: key,
        allowed: value
    }));

    const rowComponents = map(sortBy(permissions, "name"), permission => {
        const disabled = !administrator && !userPermissions[permission.name];

        return (
            <APIPermissionName
                key={permission.name}
                onClick={disabled ? null : () => onChange(permission.name, !permission.allowed)}
                disabled={disabled}
            >
                <code>{permission.name}</code>
                <Checkbox checked={permission.allowed} />
            </APIPermissionName>
        );
    });

    return <BoxGroup className={className}>{rowComponents}</BoxGroup>;
};

APIPermissions.propTypes = {
    administrator: PropTypes.bool.isRequired,
    userPermissions: PropTypes.object.isRequired,
    keyPermissions: PropTypes.object.isRequired,
    onChange: PropTypes.func.isRequired,
    className: PropTypes.string
};

const mapStateToProps = state => ({
    administrator: state.account.administrator,
    userPermissions: state.account.permissions
});

export default connect(mapStateToProps)(APIPermissions);
