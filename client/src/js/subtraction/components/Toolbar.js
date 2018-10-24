import React from "react";
import { LinkContainer } from "react-router-bootstrap";
import { FormControl, FormGroup, InputGroup } from "react-bootstrap";
import { Button, Icon } from "../../base";

const SubtractionToolbar = ({ term, onFilter, canModify }) => (
  <div key="toolbar" className="toolbar">
    <FormGroup>
      <InputGroup>
        <InputGroup.Addon>
          <Icon name="search" />
        </InputGroup.Addon>
        <FormControl
          type="text"
          value={term}
          onChange={onFilter}
          placeholder="Name"
        />
      </InputGroup>
    </FormGroup>

    {canModify ? (
      <LinkContainer to={{ state: { createSubtraction: true } }}>
        <Button bsStyle="primary" icon="plus-square fa-fw" tip="Create" />
      </LinkContainer>
    ) : null}
  </div>
);

export default SubtractionToolbar;
