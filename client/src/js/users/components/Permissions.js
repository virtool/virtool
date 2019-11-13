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
import { Col, Row } from "react-bootstrap";
import { Icon, ListGroupItem } from "../../base";
import { Box } from "../../base/Box";
import { PermissionItem } from "./Permission";

const UserPermissions = ({ permissions }) => {
    const permissionComponents = transform(
        permissions,
        (acc, value, permission) => acc.push(<PermissionItem key={permission} permission={permission} value={value} />),
        []
    );

    return (
        <Box>
            <Row>{permissionComponents}</Row>
        </Box>
    );
};

UserPermissions.propTypes = {
    permissions: PropTypes.object
};

export default UserPermissions;
