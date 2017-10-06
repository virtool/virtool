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
import PropTypes from "prop-types";
import { startCase } from "lodash";
import { Icon, ListGroupItem } from "../../../base";

export default class Permission extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            pending: false
        }

    }

    static propTypes = {
        name: PropTypes.string.isRequired,
        groupName: PropTypes.string,
        value: PropTypes.bool.isRequired,
        collection: PropTypes.object,
        disabled: PropTypes.bool
    };

    componentWillReceiveProps (nextProps) {
        if (this.props.value !== nextProps.value && this.state.pending) {
            this.setState({pending: false});
        }
    }

    handleClick = () => {
        let permissionUpdate = {};

        permissionUpdate[this.props.name] = !this.props.value;

        this.setState({pending: true}, () => {
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
            <span className="pull-right text-muted">
                {this.props.value ? <Icon name="checkmark" />: <Icon name="close" />}
            </span>
        </ListGroupItem>
    );
}
