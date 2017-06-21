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

import React, { PropTypes } from "react";
import { LinkContainer } from "react-router-bootstrap";
import { DropdownButton, MenuItem } from "react-bootstrap";
import { Icon, Button } from "virtool/js/components/Base";

/**
 * A toolbar component rendered at the top of the virus manager table. Allows searching of viruses by name and
 * abbreviation. Includes a button for creating a new virus.
 */
const VirusToolbar = (props) => {

    let menu;
    let createButton;

    if (props.account.permissions.modify_virus) {
        menu = (
            <DropdownButton id="virus-dropdown" title={<Icon name="menu" />} noCaret pullRight>
                <LinkContainer to="/viruses/export">
                    <MenuItem>
                        <Icon name="export" /> Export
                    </MenuItem>
                </LinkContainer>
                <LinkContainer to="/viruses/import">
                    <MenuItem>
                        <Icon name="new-entry" /> Import
                    </MenuItem>
                </LinkContainer>
            </DropdownButton>
        );

        createButton = (
            <LinkContainer to="/viruses/create">
                <Button bsStyle="primary" tip="Create">
                    <Icon name="new-entry" />
                </Button>
            </LinkContainer>
        );
    }

    return (
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
                        onChange={(e) => {props.onFind(e.target.value)}}
                    />
                </div>
            </div>

            <Button
                onClick={props.onToggleModifiedOnly}
                active={props.modifiedOnly}
                icon="flag"
                iconStyle="warning"
                tip="Modified Only"
            />

            <LinkContainer to="/viruses/indexes">
                <Button
                    icon="filing"
                    tip="Indexes"
                />
            </LinkContainer>

            {createButton}
            {menu}
        </div>
    );
};

VirusToolbar.propTypes = {
    account: PropTypes.object,
    onFind: PropTypes.func,
    modifiedOnly: PropTypes.bool,
    onToggleModifiedOnly: PropTypes.func
};

export default VirusToolbar;
