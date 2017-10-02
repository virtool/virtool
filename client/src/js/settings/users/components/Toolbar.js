/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports UserToolbar
 */

import React from "react";
import PropTypes from "prop-types";
import { FormGroup, InputGroup, FormControl } from "react-bootstrap";
import { Icon, Button } from "virtool/js/components/Base";

import Add from "./Add";
import Groups from "./Groups/Groups";

/**
 * A toolbar used to filter the user list, add new users, and modify groups.
 *
 * @class
 */
export default class UserToolbar extends React.PureComponent {

    constructor (props) {
        super(props);
        this.state = {
            showAddUser: false,
            showGroups: false
        };
    }

    static propTypes = {
        add: PropTypes.func.isRequired,
        onChange: PropTypes.func.isRequired
    };

    showAddUserModal = () => {
        this.setState({
            showAddUser: true,
            showGroups: false
        });
    };

    showGroupsModal = () => {
        this.setState({
            showAddUser: false,
            showGroups: true
        });
    };

    hideModal = () => {
        this.setState({
            showAddUser: false,
            showGroups: false
        });
    };

    render = () => (
        <div>
            <div className="toolbar">
                <FormGroup>
                    <InputGroup>
                        <InputGroup.Addon>
                            <Icon name="search"/>
                        </InputGroup.Addon>
                        <FormControl
                            type="text"
                            onChange={this.props.onChange}
                        />
                    </InputGroup>
                </FormGroup>

                <Button bsStyle="primary" onClick={this.showGroupsModal}>
                    <Icon name="users"/>
                </Button>

                <Button bsStyle="primary" onClick={this.showAddUserModal}>
                    <Icon name="plus-square"/>
                </Button>
            </div>

            <Add
                show={this.state.showAddUser}
                add={this.props.add}
                onHide={this.hideModal}
                collection={dispatcher.db.users}
            />

            <Groups
                show={this.state.showGroups}
                onHide={this.hideModal}
            />
        </div>
    );
}
