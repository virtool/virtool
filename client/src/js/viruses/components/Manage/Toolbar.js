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
import { LinkContainer } from "react-router-bootstrap";
import { DropdownButton, MenuItem } from "react-bootstrap";
import { Icon, Button } from "virtool/js/components/Base";

/**
 * A toolbar component rendered at the top of the virus manager table. Allows searching of viruses by name and
 * abbreviation. Includes a button for creating a new virus.
 */
export default class VirusToolbar extends React.Component {

    constructor (props) {
        super(props);
    }

    static propTypes = {
        account: React.PropTypes.object,
        onFind: React.PropTypes.func,
        modifiedOnly: React.PropTypes.bool,
        onToggleModifiedOnly: React.PropTypes.func
    };

    componentDidMount () {
        this.inputNode.focus();
    }

    render () {

        let menu;

        if (this.props.account.permissions.modify_virus) {
            menu = (
                <DropdownButton id="virus-dropdown" title={<Icon name="menu" />} noCaret pullRight>
                    <LinkContainer to="/viruses/create">
                        <MenuItem>
                            <Icon name="new-entry" /> Create
                        </MenuItem>
                    </LinkContainer>

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
        }

        return (
            <div className="toolbar">
                <div className="form-group">
                    <div className="input-group">
                        <span id="find-addon" className="input-group-addon">
                            <Icon name="search" />
                        </span>
                        <input
                            ref={(node) => this.inputNode = node}
                            aria-describedby="find-addon"
                            className="form-control"
                            type="text"
                            placeholder="Name or abbreviation"
                            onChange={(e) => {this.props.onFind(e.target.value)}}
                        />
                    </div>
                </div>

                <Button
                    onClick={this.props.onToggleModifiedOnly}
                    active={this.props.modifiedOnly}
                    icon="flag"
                    iconStyle="warning"
                    tip="Modified Only"
                />

                {menu}
            </div>
        );
    }
}
