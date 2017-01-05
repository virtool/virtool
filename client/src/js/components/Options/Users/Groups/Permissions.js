/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Groups
 */

import React from "react";
import { transform, sortBy } from "lodash-es";
import { Panel, ListGroup } from "react-bootstrap";

import Permission from "./Permission";

const Permissions = (props) => {

    if (props.permissions) {

        const permissions = transform(props.permissions, (result, value, name) => {
            result.push({
                name: name,
                value: value
            });
        }, []);

        const disabled = props.groupName === "administrator" || props.groupName === "limited";

        const permissionComponents = sortBy(permissions, "name").map(permission =>
            <Permission
                key={permission.name}
                {...permission}
                groupName={props.groupName}
                disabled={disabled}
                collection={props.collection}
            />
        );

        const listGroup = (
            <ListGroup fill={props.groupName && props.collection}>
                {permissionComponents}
            </ListGroup>
        );

        if (this.props.groupName && this.props.collection) {
            return (
                <Panel header="Permissions">
                    {listGroup}
                </Panel>
            );
        }

        return listGroup;

    }

    return <Panel>Nothing to see here</Panel>;
};

Permissions.propTypes = {
    collection: React.PropTypes.object,
    permissions: React.PropTypes.object,
    groupName: React.PropTypes.string
};
