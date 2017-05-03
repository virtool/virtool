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
import { DropdownButton, MenuItem } from "react-bootstrap";
import { Icon, Button } from "virtool/js/components/Base";

const getInitialState = () => ({
    canAdd: dispatcher.user.permissions.add_virus,
    canModify: dispatcher.user.permissions.modify_virus
});

/**
 * A toolbar component rendered at the top of the virus manager table. Allows searching of viruses by name and
 * abbreviation. Includes a button for creating a new virus.
 */
export default class VirusToolbar extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        onChange: React.PropTypes.func,
        modifiedOnly: React.PropTypes.bool,
        toggleModifiedOnly: React.PropTypes.func
    };

    componentDidMount () {
        // Focus on the input field when the component is ready.
        this.inputNode.focus();
        dispatcher.user.on("change", this.onUserChange);
    }

    componentWillUnmount () {
        dispatcher.user.off("change", this.onUserChange);
    }

    onUserChange = () => {
        this.setState(getInitialState());
    };

    /**
     * Changes state to show the add or export modal form. Triggered by clicking the a menu item.
     *
     * @param eventKey {string} - the event key.
     * @func
     */
    handleSelect = (eventKey) => {
        switch (eventKey) {
            case "add":
                window.router.setExtra(["add"]);
                break;
            case "import":
                window.router.setExtra(["import"]);
                break;
            case "export":
                window.router.setExtra(["export"]);
                break;
        }
    };

    render () {

        let menu;

        if (this.state.canAdd || this.state.canModify) {
            menu = (
                <DropdownButton
                    id="virus-dropdown"
                    title={<Icon name="menu" />}
                    onSelect={this.handleSelect}
                    noCaret pullRight
                >
                    <MenuItem eventKey="add" disabled={!this.state.canAdd}>
                        <Icon name="new-entry" /> New
                    </MenuItem>
                    <MenuItem eventKey="export" disabled={!this.state.canModify}>
                        <Icon name="export" /> Export
                    </MenuItem>
                    <MenuItem eventKey="import" disabled={!this.state.canAdd}>
                        <Icon name="new-entry" /> Import
                    </MenuItem>
                </DropdownButton>
            );
        }

        return (
            <div className="toolbar">
                <div className="form-group">
                    <div className="input-group">
                        <span id="find-addon" className="input-group-addon">
                            <Icon name="search" /> Find
                        </span>
                        <input
                            ref={(node) => this.inputNode = node}
                            aria-describedby="find-addon"
                            className="form-control"
                            type="text"
                            placeholder="Name or abbreviation"
                            onChange={this.props.onChange}
                        />
                    </div>
                </div>

                <Button
                    onClick={this.props.toggleModifiedOnly}
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
