/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SourceTypes
 */

"use strict";

import React from "react";
import ReactDOM from "react-dom";
import FlipMove from "react-flip-move";
import Toggle from "react-bootstrap-toggle";
import { clone, remove, capitalize } from "lodash";
import { Row, Col, Panel, Overlay, Popover, FormGroup, InputGroup, FormControl } from "react-bootstrap";
import { Flex, FlexItem, Icon, Button, ListGroupItem } from "virtool/js/components/Base";

/**
 * A component that allows the addition and removal of allowed source types. The use of restricted source types can also
 * be toggled.
 */
var SourceTypes = React.createClass({

    getInitialState: function () {
        return {
            sourceTypes: this.props.settings.get("allowed_source_types"),
            enabled: this.props.settings.get("restrict_source_types"),
            warning: null,
            value: ""
        };
    },

    componentDidMount: function () {
        this.getInputDOMNode().focus();
        this.props.settings.on("change", this.update);
    },

    componentWillUnmount: function () {
        this.props.settings.off("change", this.update);
    },

    shouldComponentUpdate: function (nextProps, nextState) {
        return this.state !== nextState;
    },

    /**
     * Returns a reference to the input field DOM node. Used for placing the warning overlay.
     *
     * @func
     */
    getInputDOMNode: function () {
        return ReactDOM.findDOMNode(this.refs.input);
    },

    /**
     * Updates the sourceTypes and enabled state when the settings object emits and update event.
     *
     * @func
     */
    update: function () {
        this.setState(this.getInitialState());
    },

    /**
     * Adds a source type to the list of allowed source types, resulting in a settings update being sent to the server.
     * Triggered by a click on the add button.
     *
     * @param event {object} - the form submit event.
     * @func
     */
    handleSubmit: function (event) {
        event.preventDefault();

        // Convert source type to lowercase. All source types are single words stored in lowercase. They are capitalized
        // when rendered in the application.
        var newSourceType = this.state.value.toLowerCase();
        
        // The source type cannot be an empty string...
        if (newSourceType !== "") {
            // Show warning if the source type already exists in the list.
            if (this.state.sourceTypes.indexOf(newSourceType) > -1) {
                this.setState({warning: "Source type already exists."});
            }

            // Show warning if the input string includes a space character.
            else if (newSourceType.indexOf(" ") > -1) {
                this.setState({warning: "Source types may not contain spaces."})
            }

            // If the string is acceptable add it to the existing source types list and replace the one in the
            // settings with the new one.
            else {
                var sourceTypes = _.clone(this.state.sourceTypes);
                sourceTypes.push(newSourceType);
                this.props.settings.set("allowed_source_types", sourceTypes);
                this.setState({
                    value: ""
                });
            }
        }
    },

    /**
     * Removes any warning popovers being shown. Triggered when the input field changes (fixing invalid value).
     *
     * @func
     */
    handleChange: function (event) {
        this.setState({
            value: event.target.value,
            warning: null
        });
    },

    /**
     * Remove a source type from the allowed source types list. Called when the remove icon button is clicked.
     *
     * @param sourceType {string} - the source type to remove.
     */
    remove: function (sourceType) {
        var newSourceTypes = _.remove(this.state.sourceTypes, function (n) {
            return n !== sourceType;
        });

        this.props.settings.set("allowed_source_types", newSourceTypes);
    },

    /**
     * Toggles the restriction of source types. Triggered by clicking on the "enable this feature" button.
     */
    toggleFeature: function () {
        this.props.settings.set("restrict_source_types", !this.state.enabled);
    },


    render: function () {

        var listComponents = this.state.sourceTypes.map(function (sourceType) {
            var removeButton;

            // Only show remove button is the sourceTypes feature is enabled.
            if (this.state.enabled) {
                removeButton = (
                    <Icon name="remove" onClick={function () {this.remove(sourceType)}.bind(this)} pullRight />
                );
            }

            return (
                <ListGroupItem key={sourceType} disabled={!this.state.enabled}>
                    {_.capitalize(sourceType)}
                    {removeButton}
                </ListGroupItem>
            );
        }, this);

        return (
            <div>
                <Row>
                    <Col md={6}>
                        <Flex alignItems="center" style={{marginBottom: "10px"}}>
                            <FlexItem grow={1} >
                                <strong>Source Types</strong>
                            </FlexItem>
                            <FlexItem>
                                <Toggle
                                    on="ON"
                                    off="OFF"
                                    size="small"
                                    active={this.state.enabled}
                                    onChange={this.toggleFeature}
                                />
                            </FlexItem>
                        </Flex>
                    </Col>

                    <Col md={6} />
                </Row>
                <Row>
                    <Col md={6}>
                        <Panel>
                            <form onSubmit={this.handleSubmit}>
                                <FormGroup>
                                    <InputGroup>
                                        <FormControl
                                            ref="input"
                                            type="text"
                                            value={this.state.value}
                                            onChange={this.handleChange}
                                            disabled={!this.state.enabled}
                                        />
                                        <InputGroup.Button>
                                            <Button type="submit" bsStyle="primary" disabled={!this.state.enabled}>
                                                <Icon name="plus-square" />
                                            </Button>
                                        </InputGroup.Button>
                                    </InputGroup>
                                </FormGroup>
                            </form>

                            <FlipMove typeName="div" className="list-group" leaveAnimation={false}>
                                {listComponents}
                            </FlipMove>

                            <Overlay target={this.getInputNode} show={Boolean(this.state.warning)} placement="top" animation={false}>
                                <Popover id="source-type-warning-popover">
                                    {this.state.warning}
                                </Popover>
                            </Overlay>
                        </Panel>
                    </Col>
                    <Col md={6}>
                        <Panel>
                            Configure a list of allowable source types. When a user creates a new isolate they will
                            only be able to select a source type from this list. If this feature is disabled, users will be
                            able to enter any string as a source type.
                        </Panel>
                    </Col>
                </Row>
            </div>
        );
    }

});

module.exports = SourceTypes;

