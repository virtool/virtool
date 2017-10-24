import React from "react";
import PropTypes from "prop-types";
import { LinkContainer } from "react-router-bootstrap";

import { FormGroup, InputGroup, FormControl } from "react-bootstrap";
import { Icon, Button } from "../../base";

const SampleToolbar = (props) => (
    <div key="toolbar" className="toolbar">
        <FormGroup>
            <InputGroup>
                <InputGroup.Addon>
                    <Icon name="search" />
                </InputGroup.Addon>
                <FormControl
                    type="text"
                    value={props.term}
                    onChange={(e) => props.onTermChange(e.target.value)}
                    placeholder="Sample name"
                />
            </InputGroup>
        </FormGroup>

        <LinkContainer to="/samples/files">
            <Button tip="Read Files" icon="folder-open" />
        </LinkContainer>

        <Button
            tip="Create Sample"
            icon="new-entry"
            bsStyle="primary"
            onClick={() => props.history.replace(props.location.pathname + props.location.search, {create: true})}
        />
    </div>
);

SampleToolbar.propTypes = {
    term: PropTypes.string,
    onTermChange: PropTypes.func,
    location: PropTypes.object,
    history: PropTypes.object,
};

export default SampleToolbar;
