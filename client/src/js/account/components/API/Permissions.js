import { map, sortBy } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import { ListGroup } from "react-bootstrap";
import { connect } from "react-redux";
import { Checkbox, ListGroupItem, Panel } from "../../../base";

export const APIPermissions = ({ administrator, style, userPermissions, keyPermissions, onChange }) => {
    const permissions = map(keyPermissions, (value, key) => ({
        name: key,
        allowed: value
    }));

    const rowComponents = map(sortBy(permissions, "name"), permission => {
        const disabled = !administrator && !userPermissions[permission.name];

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
            <ListGroup>{rowComponents}</ListGroup>
        </Panel>
    );
};

APIPermissions.propTypes = {
    administrator: PropTypes.bool.isRequired,
    userPermissions: PropTypes.object.isRequired,
    keyPermissions: PropTypes.object.isRequired,
    onChange: PropTypes.func.isRequired,
    style: PropTypes.object
};

const mapStateToProps = state => ({
    administrator: state.account.administrator,
    userPermissions: state.account.permissions
});

export default connect(mapStateToProps)(APIPermissions);
