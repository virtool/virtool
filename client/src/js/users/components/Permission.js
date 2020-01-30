import React from "react";
import { Icon, ListGroupItem } from "../../base";

export const PermissionItem = ({ permission, value }) => (
    <ListGroupItem bsStyle={value ? "success" : "danger"}>
        <code>{permission}</code> <Icon name={value ? "check" : "times"} pullRight />
    </ListGroupItem>
);
