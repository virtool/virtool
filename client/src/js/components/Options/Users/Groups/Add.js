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

import React from "react";
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

    handleSubmit = (event) => {
        event.preventDefault();

        const groupName = this.state.groupName.toLowerCase();

        // Make sure the new group name has no spaces in it.
        if (groupName.length > 0 && groupName.indexOf(" ") === -1) {
            dispatcher.db.groups.request("add", {
                _id: groupName.toLowerCase()
            })
            .success(() => {
                this.setState({
                    groupName: "",
                    error: null
                });
            })
            .failure((data) => {
                this.setState({
                    error: data.message
                });
            });
        } else {
            this.setState({
                error: "Group names must not contain spaces and cannot be empty strings."
            });
        }
    };

    handleChange = (event) => {
        this.setState({
            groupName: event.target.value,
            error: false
        });
    };

    render () {

        let overlay;

        if (this.state.error) {
            const overlayProps = {
                target: this.inputNode,
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
                            ref={this.inputNode}
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
