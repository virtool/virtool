/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports JobsToolbar
 */

"use strict";

import React from "react";
import ReactDOM from "react-dom";
import { map } from "lodash";
import { InputGroup, FormGroup, FormControl, Dropdown, MenuItem } from "react-bootstrap";

import Icon from "virtool/js/components/Base/Icon.jsx";
import Flex from "virtool/js/components/Base/Flex.jsx";
import PushButton from "virtool/js/components/Base/PushButton.jsx";

/**
 * A form-based component used to filter the documents presented in JobsTable component.
 *
 * @class
 */
var JobsToolbar = React.createClass({

    getInitialState: function () {
        return {
            task: "",
            username: "",
            pendingRemove: false
        };
    },

    componentDidMount: function () {
        // Focus on the first (task) form field when the component has mounted.
        ReactDOM.findDOMNode(this.refs.find).focus();
    },

    handleSelect: function (eventKey) {

        var toRemove;

        if (eventKey === "removeComplete") {
            toRemove = map(dispatcher.db.jobs.find({
                state: "complete"
            }), "_id");
        }

        if (eventKey === "removeFailed") {
            toRemove = map(dispatcher.db.jobs.find({$or: [
                {state: "error"},
                {state: "cancelled"}
            ]}), "_id");
        }

        if (toRemove) {
            this.clearRemove(toRemove);
        }
    },

    clear: function () {
        var toRemove = map(dispatcher.db.jobs.find({$or: [
            {state: "complete"},
            {state: "error"},
            {state: "cancelled"}
        ]}), "_id");

        this.clearRemove(toRemove);
    },

    clearRemove: function (toRemove) {
        if (toRemove.length > 0) {
            this.setState({pendingRemove: true}, function () {
                dispatcher.db.jobs.request("remove_job", {_id: toRemove})
                    .success(function () {
                        this.setState({pendingRemove: false});
                    }, this)
                    .failure(function () {
                        this.setState({pendingRemove: false});
                    }, this)
            });
        }
    },

    render: function () {

        var removalDropdown;

        if (this.props.canRemove) {
            removalDropdown = (
                <Flex.Item pad>
                    <Dropdown id="job-clear-dropdown" onSelect={this.handleSelect} className="split-dropdown" pullRight>
                        <PushButton onClick={this.clear} tip="Clear Finished">
                            <Icon name="remove" pending={this.state.pendingRemove} />
                        </PushButton>
                        <Dropdown.Toggle />
                        <Dropdown.Menu>
                            <MenuItem eventKey="removeFailed">Failed</MenuItem>
                            <MenuItem eventKey="removeComplete">Complete</MenuItem>
                        </Dropdown.Menu>
                    </Dropdown>
                </Flex.Item>
            );
        }

        return (
            <Flex>
                <Flex.Item grow={1}>
                    <FormGroup>
                        <InputGroup>
                            <InputGroup.Addon>
                                <Icon name="search" /> Find
                            </InputGroup.Addon>
                            <FormControl
                                ref="find"
                                name="find"
                                onChange={this.props.setFindTerm}
                                value={this.props.findTerm}
                            />
                        </InputGroup>
                    </FormGroup>
                </Flex.Item>

                <Flex.Item pad>
                    <PushButton onClick={this.props.changeDirection} tip="Sort Direction">
                        <Icon name={this.props.sortDescending ? "sort-desc": "sort-asc"} />
                    </PushButton>
                </Flex.Item>

                {removalDropdown}
            </Flex>
        );
    }
});

module.exports = JobsToolbar;
