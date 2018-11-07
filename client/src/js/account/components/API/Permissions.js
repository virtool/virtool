import React from "react";
import PropTypes from "prop-types";
import { map, sortBy } from "lodash-es";
import { ListGroup, Panel } from "react-bootstrap";

import { ListGroupItem, Checkbox } from "../../../base/index";

export default function APIPermissions({ style, userPermissions, keyPermissions, onChange }) {
    const permissions = map(keyPermissions, (value, key) => ({
        name: key,
        allowed: value
    }));

    const rowComponents = map(sortBy(permissions, "name"), permission => {
        const disabled = !userPermissions[permission.name];

        return (
            <ListGroupItem
                key={permission.name}
                onClick={disabled ? null : () => onChange(permission.name, !permission.allowed)}
                disabled={disabled}
            >
                <code>{permission.name}</code>
                <Checkbox checked={permission.allowed} pullRight />
            </ListGroupItem>
        );
    });

    return (
        <Panel style={style}>
            <Panel.Body>
                <ListGroup>{rowComponents}</ListGroup>
            </Panel.Body>
        </Panel>
    );
}

APIPermissions.propTypes = {
    userPermissions: PropTypes.object.isRequired,
    keyPermissions: PropTypes.object.isRequired,
    onChange: PropTypes.func.isRequired,
    style: PropTypes.object
};
