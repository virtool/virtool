import React from "react";
import { Panel } from "react-bootstrap";
import { transform } from "lodash-es";
import { ListGroupItem, Icon } from "../../../base";

const UserEntry = ({ onEdit, onRemove, onToggleSelect, id, permissions, isSelected }) => (
    <div>
        <ListGroupItem key={id} onClick={() => onToggleSelect(id)}>
            <div style={{textAlign: "right"}}>
                <div style={{float: "left"}}>{id}</div>
                {onRemove
                    ? (
                        <Icon
                            name="minus-circle"
                            bsStyle="danger"
                            tip="Remove Member"
                            onClick={() => onRemove(id)}
                        />)
                    : null}

            </div>
        </ListGroupItem>
        {isSelected
            ? (
                <Panel>
                    <Panel.Body>
                        <label>Permissions</label>
                        {transform(permissions, (result, value, key) => {
                            result.push(
                                <ListGroupItem
                                    key={key}
                                    onClick={() => onEdit(id, key, !value)}
                                    bsStyle={value ? "success" : "danger"}
                                >
                                    <code>{key}</code>
                                    <Icon faStyle="far" name={value ? "check-square" : "square"} pullRight />
                                </ListGroupItem>
                            );
                            return result;
                        }, [])}
                    </Panel.Body>
                </Panel>
            )
            : null}
    </div>
);

export default UserEntry;
