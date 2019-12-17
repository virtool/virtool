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

import { transform } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import styled from "styled-components";
import { Box } from "../../base/Box";
import { device } from "../../base";
import { PermissionItem } from "./Permission";

const StyledUserPermissions = styled(Box)`
    @media (min-width: ${device.desktop}) {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr 1fr;
        grid-gap: 6px;
    }
`;

const UserPermissions = ({ permissions }) => {
    const permissionComponents = transform(
        permissions,
        (acc, value, permission) => acc.push(<PermissionItem key={permission} permission={permission} value={value} />),
        []
    );

    return <StyledUserPermissions>{permissionComponents}</StyledUserPermissions>;
};

UserPermissions.propTypes = {
    permissions: PropTypes.object
};

export default UserPermissions;
