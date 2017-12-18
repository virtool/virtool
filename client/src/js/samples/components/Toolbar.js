import React from "react";
import PropTypes from "prop-types";
import { LinkContainer } from "react-router-bootstrap";

import { FormGroup, InputGroup, FormControl } from "react-bootstrap";
import { Icon, Button } from "../../base";

const SampleToolbar = ({ canCreate, history, location, onTermChange, term }) => (
    <div key="toolbar" className="toolbar">
        <FormGroup>
            <InputGroup>
                <InputGroup.Addon>
                    <Icon name="search" />
                </InputGroup.Addon>
                <FormControl
                    type="text"
                    value={term}
                    onChange={(e) => onTermChange(e.target.value)}
                    placeholder="Sample name"
                />
            </InputGroup>
        </FormGroup>

        <LinkContainer to="/samples/files">
            <Button tip="Read Files" icon="folder-open" />
        </LinkContainer>

        {canCreate ? (
            <Button
                tip="Create Sample"
                icon="new-entry"
                bsStyle="primary"
                onClick={() => history.replace(location.pathname + location.search, {create: true})}
            />
        ) : null}
    </div>
);

SampleToolbar.propTypes = {
    canCreate: PropTypes.bool,
    term: PropTypes.string,
    onTermChange: PropTypes.func,
    location: PropTypes.object,
    history: PropTypes.object
};

export default SampleToolbar;
