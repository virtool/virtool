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

import React from "react";
import FlipMove from "react-flip-move";
import { reject, capitalize } from "lodash";
import { Row, Col, Panel, Overlay, Popover, FormGroup, InputGroup, FormControl } from "react-bootstrap";
import { Flex, FlexItem, Icon, Button, Checkbox, ListGroupItem, getFlipMoveProps } from "virtool/js/components/Base";

/**
 * A component that allows the addition and removal of allowed source types. The use of restricted source types can also
 * be toggled.
 */
export default class SourceTypes extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            value: "",
            warning: null
        }
    }

    static propTypes = {
        set: React.PropTypes.func,
        settings: React.PropTypes.object
    };

    componentDidMount () {
        this.inputNode.focus();
    }

    handleSubmit = (event) => {

        event.preventDefault();

        // Convert source type to lowercase. All source types are single words stored in lowercase. They are capitalized
        // when rendered in the application.
        const newSourceType = this.state.value.toLowerCase();
        
        // The source type cannot be an empty string...
        if (newSourceType !== "") {
            // Show warning if the source type already exists in the list.
            if (this.props.settings.allowed_source_types.indexOf(newSourceType) > -1) {
                this.setState({warning: "Source type already exists."});
            }

            // Show warning if the input string includes a space character.
            else if (newSourceType.indexOf(" ") > -1) {
                this.setState({warning: "Source types may not contain spaces."})
            }

            // If the string is acceptable add it to the existing source types list and replace the one in the
            // settings with the new one.
            else {
                this.props.set("allowed_source_types", this.props.settings.allowed_source_types.concat(newSourceType));
                this.setState({
                    value: "",
                    warning: null
                });
            }
        }
    };

    handleChange = (event) => {
        this.setState({
            value: event.target.value,
            warning: null
        });
    };

    removeSourceType = (sourceType) => {
        this.props.set("allowed_source_types", reject(this.props.settings.allowed_source_types, n => n == sourceType));
    };


    render () {

        const restrictSourceTypes = this.props.settings.restrict_source_types;

        const listComponents = this.props.settings.allowed_source_types.map((sourceType) => {
            let removeButton;

            // Only show remove button is the sourceTypes feature is enabled.
            if (restrictSourceTypes) {
                removeButton = (
                    <Icon name="remove" onClick={() => this.removeSourceType(sourceType)} pullRight />
                );
            }

            return (
                <ListGroupItem key={sourceType} disabled={!restrictSourceTypes}>
                    {capitalize(sourceType)}
                    {removeButton}
                </ListGroupItem>
            );
        }, this);

        return (
            <div>
                <Row>
                    <Col md={6}>
                        <Flex alignItems="center">
                            <FlexItem grow={1} >
                                <h5><strong>Source Types</strong></h5>
                            </FlexItem>
                            <FlexItem>
                                <Checkbox
                                    label="Enable"
                                    checked={restrictSourceTypes}
                                    onClick={() => this.props.set("restrict_source_types", !restrictSourceTypes)}
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
                                            type="text"
                                            inputRef={(input) => this.inputNode = input}
                                            value={this.state.value}
                                            onChange={this.handleChange}
                                            disabled={!restrictSourceTypes}
                                        />
                                        <InputGroup.Button>
                                            <Button type="submit" bsStyle="primary" disabled={!restrictSourceTypes}>
                                                <Icon name="plus-square" />
                                            </Button>
                                        </InputGroup.Button>
                                    </InputGroup>
                                </FormGroup>
                            </form>

                            <FlipMove {...getFlipMoveProps()}>
                                {listComponents}
                            </FlipMove>

                            <Overlay
                                target={this.inputNode}
                                container={this}
                                show={Boolean(this.state.warning)}
                                placement="top"
                                animation={false}
                            >
                                <Popover id="source-type-warning-popover">
                                    {this.state.warning}
                                </Popover>
                            </Overlay>
                        </Panel>
                    </Col>
                    <Col md={6}>
                        <Panel>
                            Configure a list of allowable source types. When a user creates a new isolate they will
                            only be able to select a source type from this list. If this feature is disabled, users
                            will be able to enter any string as a source type.
                        </Panel>
                    </Col>
                </Row>
            </div>
        );
    }
}
