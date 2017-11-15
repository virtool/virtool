/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports VirusToolbar
 */

import React from "react";
import PropTypes from "prop-types";
import { LinkContainer } from "react-router-bootstrap";

import { Icon, Button } from "../../base";

/**
 * A toolbar component rendered at the top of the virus manager table. Allows searching of viruses by name and
 * abbreviation. Includes a button for creating a new virus.
 */
const VirusToolbar = (props) => (
    <div className="toolbar">
        <div className="form-group">
            <div className="input-group">
                <span id="find-addon" className="input-group-addon">
                    <Icon name="search" />
                </span>
                <input
                    aria-describedby="find-addon"
                    className="form-control"
                    type="text"
                    placeholder="Name or abbreviation"
                    onChange={e => {props.onChangeTerm(e.target.value)}}
                />
            </div>
        </div>

        <LinkContainer to="/viruses/indexes">
            <Button
                icon="filing"
                tip="Indexes"
            />
        </LinkContainer>

        {props.canModify ? (
            <LinkContainer to="/viruses/create">
                <Button bsStyle="primary" tip="Create">
                    <Icon name="new-entry" />
                </Button>
            </LinkContainer>
        ): null}
    </div>
);

VirusToolbar.propTypes = {
    canModify: PropTypes.bool,
    modifiedOnly: PropTypes.bool,
    onChangeTerm: PropTypes.func,
    onToggleModifiedOnly: PropTypes.func
};

export default VirusToolbar;
