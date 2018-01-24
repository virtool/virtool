import React from "react";
import PropTypes from "prop-types";
import { map, sortBy } from "lodash-es";
import { ListGroup, Panel } from "react-bootstrap";

import { Icon, ListGroupItem } from "../../../base/index";

export default function APIPermissions ({ style, userPermissions, keyPermissions, onChange }) {

    const permissions = map(keyPermissions, (value, key) => ({name: key, allowed: value}));

    const rowComponents = sortBy(permissions, "name").map(permission => {
        const disabled = !userPermissions[permission.name];

        return (
            <ListGroupItem
                key={permission.name}
                onClick={disabled ? null : () => onChange(permission.name, !permission.allowed)}
                disabled={disabled}
            >
                <code>{permission.name}</code>
                <Icon name={`checkbox-${permission.allowed ? "checked" : "unchecked"}`} pullRight />
            </ListGroupItem>
        );
    });

    return (
        <Panel style={style}>
            <ListGroup fill>
                {rowComponents}
            </ListGroup>
        </Panel>
    );
}

APIPermissions.propTypes = {
    userPermissions: PropTypes.object.isRequired,
    keyPermissions: PropTypes.object.isRequired,
    onChange: PropTypes.func.isRequired,
    style: PropTypes.object
};
