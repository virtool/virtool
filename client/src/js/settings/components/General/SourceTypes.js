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
import { union } from "lodash";
import { connect } from "react-redux";
import { capitalize } from "lodash";
import { Row, Col, Panel, Overlay, Popover, FormGroup, InputGroup, FormControl } from "react-bootstrap";

import { Flex, FlexItem, Icon, Button, Checkbox, ListGroupItem } from "virtool/js/components/Base";
import { setSourceTypeValue, updateSettings } from "../../actions";

/**
 * A component that allows the addition and removal of allowed source types. The use of restricted source types can also
 * be toggled.
 */
class SourceTypes extends React.Component {

    static propTypes = {
        restrictSourceTypes: React.PropTypes.bool.isRequired,
        allowedSourceTypes: React.PropTypes.arrayOf(React.PropTypes.string),
        value: React.PropTypes.string,

        onChange: React.PropTypes.func,
        onSubmit: React.PropTypes.func,
        onToggle: React.PropTypes.func
    };

    /*

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
                this.props.set("allowed_source_types", this.props.allowedSourceTypes.concat(newSourceType));
                this.setState({
                    value: "",
                    warning: null
                });
            }
        }
    };

    */

    handleSubmit = () => {
        this.props.onSubmit(union([this.props.value], this.props.allowedSourceTypes));
    };

    render () {

        const restrictSourceTypes = this.props.restrictSourceTypes;

        const listComponents = this.props.allowedSourceTypes.map((sourceType) => {
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
        });

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
                                    checked={this.props.restrictSourceTypes}
                                    onClick={() => {this.props.onToggle(!this.props.restrictSourceTypes)}}
                                />
                            </FlexItem>
                        </Flex>
                    </Col>

                    <Col md={6} />
                </Row>
                <Row>
                    <Col md={6}>
                        <Panel>
                            <form onSubmit={this.onSubmit}>
                                <FormGroup>
                                    <InputGroup>
                                        <FormControl
                                            type="text"
                                            inputRef={(input) => this.inputNode = input}
                                            disabled={!restrictSourceTypes}
                                            onChange={(e) => this.props.onChange(e.target.value)}
                                            value={this.props.value}
                                        />
                                        <InputGroup.Button>
                                            <Button type="submit" bsStyle="primary" disabled={!restrictSourceTypes}>
                                                <Icon name="plus-square" />
                                            </Button>
                                        </InputGroup.Button>
                                    </InputGroup>
                                </FormGroup>
                            </form>

                            <div>
                                {listComponents}
                            </div>

                            <Overlay
                                target={this.inputNode}
                                container={this}
                                placement="top"
                                animation={false}
                            >
                                <Popover id="source-type-warning-popover">
                                    Warning
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

const mapStateToProps = (state) => {
    return {
        restrictSourceTypes: state.settings.data.restrict_source_types,
        allowedSourceTypes: state.settings.data.allowed_source_types,
        value: state.settings.sourceTypes.value
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onToggle: (value) => {
            dispatch(updateSettings({restrict_source_types: value}));
        },

        onChange: (value) => {
            dispatch(setSourceTypeValue(value));
        },

        onSubmit: (allowedSourceTypes) => {
            const update = {
                allowed_source_types: allowedSourceTypes
            };

            dispatch(updateSettings(update))
        }
    };
};

const SourceTypesContainer = connect(
    mapStateToProps,
    mapDispatchToProps
)(SourceTypes);

export default SourceTypesContainer;
