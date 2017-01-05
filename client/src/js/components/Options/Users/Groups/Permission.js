/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Permission
 */

import React from "react";
import { startCase } from "lodash";
import { Checkbox, ListGroupItem } from "virtool/js/components/Base";

export default class Permission extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            pending: false
        }

    }

    static propTypes = {
        name: React.PropTypes.string.isRequired,
        groupName: React.PropTypes.string,
        value: React.PropTypes.bool.isRequired,
        collection: React.PropTypes.object,
        disabled: React.PropTypes.bool
    };

    componentWillReceiveProps (nextProps) {
        if (this.props.value !== nextProps.value && this.state.pending) {
            this.setState({pending: false});
        }
    }

    handleClick = () => {
        let permissionUpdate = {};

        permissionUpdate[this.props.name] = !this.props.value;

        this.setState({pending: true}, function () {
            dispatcher.db.groups.request("update_permissions", {
                _id: this.props.groupName,
                permissions: permissionUpdate
            });
        });
    };

    render = () => (
        <ListGroupItem
            onClick={this.props.collection && this.props.groupName ? this.handleClick: null}
            disabled={this.props.disabled}
        >
            {startCase(this.props.name)}
            <span className="pull-right">
                <Checkbox checked={this.props.value} />
            </span>
        </ListGroupItem>
    );
}
