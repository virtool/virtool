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

import React from "react";
import {InputGroup, FormGroup, FormControl, Dropdown, MenuItem} from "react-bootstrap";
import { Icon, Flex, FlexItem, Button } from "virtool/js/components/Base";

export default class JobsToolbar extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            task: "",
            username: "",
            pendingRemove: false
        };
    }

    static propTypes = {
        findTerm: React.PropTypes.string,
        setFindTerm: React.PropTypes.func,

        sortDescending: React.PropTypes.bool,
        changeDirection: React.PropTypes.func,

        canModify: React.PropTypes.bool,
        canRemove: React.PropTypes.bool
    };

    componentDidMount () {
        this.findNode.focus();
    }

    handleSelect = (eventKey) => {

        let toRemove;

        if (eventKey === "removeComplete") {
            toRemove = dispatcher.db.jobs.find({ state: "complete" }).map(d => d["_id"]);
        }

        if (eventKey === "removeFailed") {
            toRemove = dispatcher.db.jobs.find({$or: [
                {state: "error"},
                {state: "cancelled"}
            ]}).map(d => d["_id"]);
        }

        if (toRemove) {
            this.clearRemove(toRemove);
        }
    };

    clear = () => {
        const toRemove = dispatcher.db.jobs.find({$or: [
            {state: "complete"},
            {state: "error"},
            {state: "cancelled"}
        ]}).map(d => d["_id"]);

        this.clearRemove(toRemove);
    };

    clearRemove = (toRemove) => {
        if (toRemove.length > 0) {
            this.setState({pendingRemove: true}, () => {
                dispatcher.db.jobs.request("remove_job", {_id: toRemove})
                    .success(() => {
                        this.setState({pendingRemove: false});
                    })
                    .failure(() => {
                        this.setState({pendingRemove: false});
                    })
            });
        }
    };

    render () {

        let removalDropdown;

        if (this.props.canRemove) {
            removalDropdown = (
                <FlexItem pad>
                    <Dropdown id="job-clear-dropdown" onSelect={this.handleSelect} className="split-dropdown" pullRight>
                        <Button onClick={this.clear} tip="Clear Finished">
                            <Icon name="remove" pending={this.state.pendingRemove} />
                        </Button>
                        <Dropdown.Toggle />
                        <Dropdown.Menu>
                            <MenuItem eventKey="removeFailed">Failed</MenuItem>
                            <MenuItem eventKey="removeComplete">Complete</MenuItem>
                        </Dropdown.Menu>
                    </Dropdown>
                </FlexItem>
            );
        }

        return (
            <Flex>
                <FlexItem grow={1}>
                    <FormGroup>
                        <InputGroup>
                            <InputGroup.Addon>
                                <Icon name="search" /> Find
                            </InputGroup.Addon>
                            <FormControl
                                name="find"
                                inputRef={(node) => this.findNode = node}
                                onChange={this.props.setFindTerm}
                                value={this.props.findTerm}
                            />
                        </InputGroup>
                    </FormGroup>
                </FlexItem>

                <FlexItem pad>
                    <Button onClick={this.props.changeDirection} tip="Sort Direction">
                        <Icon name={this.props.sortDescending ? "sort-desc": "sort-asc"} />
                    </Button>
                </FlexItem>

                {removalDropdown}
            </Flex>
        );
    }
}
