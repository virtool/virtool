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
import { FormGroup, InputGroup, FormControl } from "react-bootstrap";
import { Flex, FlexItem, Icon, Button } from "virtool/js/components/Base";

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
        add: React.PropTypes.func.isRequired,
        onChange: React.PropTypes.func.isRequired
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
            <Flex>
                <FlexItem grow={1}>
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
                </FlexItem>

                <FlexItem pad>
                    <Button bsStyle="primary" onClick={this.showGroupsModal}>
                        <Icon name="users"/>
                    </Button>
                </FlexItem>

                <FlexItem pad>
                    <Button bsStyle="primary" onClick={this.showAddUserModal}>
                        <Icon name="plus-square"/>
                    </Button>
                </FlexItem>
            </Flex>

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
