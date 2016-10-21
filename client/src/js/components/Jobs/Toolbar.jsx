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

'use strict';

var _ = require('lodash');
var React = require('react');
var ReactDOM = require('react-dom');
var InputGroup = require('react-bootstrap/lib/InputGroup');
var FormGroup = require('react-bootstrap/lib/FormGroup');
var FormControl = require('react-bootstrap/lib/FormControl');
var Dropdown = require('react-bootstrap/lib/Dropdown');
var MenuItem = require('react-bootstrap/lib/MenuItem');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

/**
 * A form-based component used to filter the documents presented in JobsTable component.
 *
 * @class
 */
var JobsToolbar = React.createClass({

    getInitialState: function () {
        return {
            task: '',
            username: '',
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
            toRemove = _.map(dispatcher.db.jobs.find({
                state: "complete"
            }), "_id");
        }

        if (eventKey === "removeFailed") {
            toRemove = _.map(dispatcher.db.jobs.find({$or: [
                {state: "error"},
                {state: "cancelled"}
            ]}), "_id");
        }

        if (toRemove) {
            this.clearRemove(toRemove);
        }
    },

    clear: function () {
        var toRemove = _.map(dispatcher.db.jobs.find({$or: [
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
                        <PushButton bsStyle="danger" onClick={this.clear} tip="Clear Finished">
                            <Icon name="remove" pending={this.state.pendingRemove} />
                        </PushButton>
                        <Dropdown.Toggle bsStyle="danger" />
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
