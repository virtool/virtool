/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports AddGroup
 */

"use strict";

import React from "react";
import ReactDOM from "react-dom";
import { Overlay, Popover, FormGroup, InputGroup, FormControl } from "react-bootstrap";
import { Icon, Button } from "virtool/js/components/Base";

export default class AddGroup extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            groupName: "",
            error: null
        };
    }

    getInputDOMNode = () => {
        return ReactDOM.findDOMNode(this.refs.input);
    }

    handleSubmit = (event) => {
        event.preventDefault();

        var groupName = this.state.groupName.toLowerCase();

        // Make sure the new group name has no spaces in it.
        if (groupName.length > 0 && groupName.indexOf(" ") === -1) {
            this.setState({pending: true}, function () {
                dispatcher.db.groups.request("add", {
                    _id: groupName.toLowerCase()
                })
                .success(function () {
                    this.setState(this.getInitialState());
                }, this)
                .failure(function (data) {
                    this.setState({
                        pending: false,
                        error: data.message
                    })
                }, this);
            });
        } else {
            this.setState({
                error: "Group names must not contain spaces and cannot be empty strings."
            });
        }
    }

    handleChange = (event) => {
        this.setState({
            groupName: event.target.value,
            error: false
        });
    }

    render () {

        let overlay;

        if (this.state.error) {
            const overlayProps = {
                target: this.getInputDOMNode,
                animation: true,
                placement: "top"
            };

            overlay = (
                <Overlay {...overlayProps} show={true}>
                    <Popover id="input-error-popover">
                        <span className="text-danger">{this.state.error}</span>
                    </Popover>
                </Overlay>
            );
        }

        return (
            <form onSubmit={this.handleSubmit}>
                {overlay}

                <FormGroup>
                    <InputGroup>
                        <FormControl
                            ref="input"
                            type="text"
                            placeholder="New group name"
                            value={this.state.groupName}
                            onChange={this.handleChange}
                        />
                        <InputGroup.Button>
                            <Button type="submit" bsStyle="primary">
                                <Icon name="plus-square" />
                            </Button>
                        </InputGroup.Button>
                    </InputGroup>
                </FormGroup>

            </form>
        );
    }
}