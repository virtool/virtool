import React from "react";
import { Panel } from "react-bootstrap";
import { transform } from "lodash-es";
import { ListGroupItem, Icon, Identicon, Flex, FlexItem } from "../../../base";

const MemberEntry = ({
  onEdit,
  onRemove,
  onToggleSelect,
  add,
  id,
  identicon,
  permissions,
  isSelected
}) => (
  <div style={{ marginBottom: "-1px" }}>
    <div
      className="list-group-item"
      key={id}
      onClick={() => onToggleSelect(id)}
    >
      <Flex alignItems="center">
        {identicon ? <Identicon size={32} hash={identicon} /> : null}
        <FlexItem pad={10}>{id}</FlexItem>
        <FlexItem grow={1} shrink={1}>
          {onRemove ? (
            <Icon
              name="trash"
              bsStyle="danger"
              tip="Remove Member"
              pullRight
              onClick={() => onRemove(id)}
            />
          ) : null}
          {add ? (
            <Icon
              name="check"
              bsStyle="success"
              tip="Selected Member"
              pullRight
            />
          ) : null}
        </FlexItem>
      </Flex>
    </div>
    {isSelected ? (
      <Panel style={{ margin: "0" }}>
        <Panel.Body>
          <label>Permissions</label>
          {transform(
            permissions,
            (result, value, key) => {
              result.push(
                <ListGroupItem
                  key={key}
                  onClick={() => onEdit(id, key, !value)}
                  bsStyle={value ? "success" : "danger"}
                >
                  <code>{key}</code>
                  <Icon
                    faStyle="far"
                    name={value ? "check-square" : "square"}
                    pullRight
                  />
                </ListGroupItem>
              );
              return result;
            },
            []
          )}
        </Panel.Body>
      </Panel>
    ) : null}
  </div>
);

export default MemberEntry;
