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
import { transform, sortBy } from "lodash";
import { Panel, ListGroup } from "react-bootstrap";

import Permission from "./Permission";

export default class Permissions extends React.Component {

    static propTypes = {
        collection: React.PropTypes.object,
        permissions: React.PropTypes.object,
        groupName: React.PropTypes.string
    };

    render () {

        if (this.props.permissions) {

            const permissions = transform(this.props.permissions, (result, value, name) => {
                result.push({
                    name: name,
                    value: value
                });
            }, []);

            const disabled = this.props.groupName === "administrator" || this.props.groupName === "limited";

            const permissionComponents = sortBy(permissions, "name").map(permission =>
                <Permission
                    key={permission.name}
                    {...permission}
                    groupName={this.props.groupName}
                    disabled={disabled}
                    collection={this.props.collection}
                />
            );

            const listGroup = (
                <ListGroup fill={this.props.groupName && this.props.collection}>
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

    }
}
