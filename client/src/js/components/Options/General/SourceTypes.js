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
import Toggle from "react-bootstrap-toggle";
import { remove, capitalize } from "lodash-es";
import { Row, Col, Panel, Overlay, Popover, FormGroup, InputGroup, FormControl } from "react-bootstrap";
import { Flex, FlexItem, Icon, Button, ListGroupItem } from "virtool/js/components/Base";

/**
 * A component that allows the addition and removal of allowed source types. The use of restricted source types can also
 * be toggled.
 */
export default class SourceTypes extends React.PureComponent {

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
                this.props.set("allowed_source_types", this.state.sourceTypes.concat(newSourceType));
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
        const newSourceTypes = remove(this.state.sourceTypes, n => n !== sourceType);
        this.props.set("allowed_source_types", newSourceTypes);
    };


    render () {

        var listComponents = this.state.sourceTypes.map(function (sourceType) {
            var removeButton;

            // Only show remove button is the sourceTypes feature is enabled.
            if (this.state.enabled) {
                removeButton = (
                    <Icon name="remove" onClick={() => this.removeSourceType(sourceType)} pullRight />
                );
            }

            return (
                <ListGroupItem key={sourceType} disabled={!this.state.enabled}>
                    {capitalize(sourceType)}
                    {removeButton}
                </ListGroupItem>
            );
        }, this);

        const restrictSourceTypes = this.props.settings.restrict_source_types;

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
                                    onChange={() => this.props.set("restrict_source_types", !restrictSourceTypes)}
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
                                            ref={this.inputNode}
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

                            <Overlay
                                target={this.getInputNode}
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
