import React from "react";
import { without } from "lodash";
import { connect } from "react-redux";
import { Row, Col, Panel, Overlay, Popover, FormGroup, InputGroup, FormControl } from "react-bootstrap";

import { Flex, FlexItem, Icon, Button, Checkbox, ListGroupItem } from "../../../base";
import { updateSetting } from "../../actions";

const getInitialState = ({
    value: "",
    error: null
});

class SourceTypes extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    remove = (sourceType) => {
        this.props.onUpdate(without(this.props.settings.allowed_source_types, sourceType));
    };

    handleSubmit = (e) => {
        e.preventDefault();

        // Do nothing if the sourceType is an empty string.
        if (this.state.value !== "") {
            // Convert source type to lowercase. All source types are single words stored in lowercase. They are
            // capitalized when rendered in the application.
            const newSourceType = this.state.value.toLowerCase();


            if (this.props.settings.allowed_source_types.includes(newSourceType)) {
                // Show error if the source type already exists in the list.
                this.setState({error: "Source type already exists."});
            } else if (newSourceType.includes(" ")) {
                // Show error if the input string includes a space character.
                this.setState({error: "Source types may not contain spaces."});
            } else {
                const newSourceTypes = this.props.settings.allowed_source_types.concat([newSourceType]);
                this.props.onUpdate(newSourceTypes);
                this.setState(getInitialState());
            }
        }
    };

    render () {

        const restrictSourceTypes = this.props.settings.restrict_source_types;

        const listComponents = this.props.settings.allowed_source_types.sort().map((sourceType) => {
            let removeButton;

            // Only show remove button is the sourceTypes feature is enabled.
            if (restrictSourceTypes) {
                removeButton = (
                    <Icon name="remove" onClick={() => this.remove(sourceType)} pullRight />
                );
            }

            return (
                <ListGroupItem key={sourceType} disabled={!restrictSourceTypes}>
                    <span className="text-capitalize">{sourceType}</span>
                    {removeButton}
                </ListGroupItem>
            );
        });

        return (
            <div>
                <Row>
                    <Col xs={12} md={6}>
                        <Flex alignItems="center">
                            <FlexItem grow={1} >
                                <h5><strong>Source Types</strong></h5>
                            </FlexItem>
                            <FlexItem>
                                <Checkbox
                                    label="Enable"
                                    checked={restrictSourceTypes}
                                    onClick={() => this.props.onToggle(!restrictSourceTypes)}
                                />
                            </FlexItem>
                        </Flex>
                    </Col>

                    <Col smHidden md={6} />
                </Row>
                <Row>
                    <Col xs={12} md={6} mdPush={6}>
                        <Panel>
                            Configure a list of allowable source types. When a user creates a new isolate they will
                            only be able to select a source type from this list. If this feature is disabled, users
                            will be able to enter any string as a source type.
                        </Panel>
                    </Col>
                    <Col xs={12} md={6} mdPull={6}>
                        <Panel>
                            <form onSubmit={this.handleSubmit}>
                                <FormGroup>
                                    <InputGroup ref={(node) => this.containerNode = node}>
                                        <FormControl
                                            type="text"
                                            inputRef={(node) => this.inputNode = node}
                                            disabled={!restrictSourceTypes}
                                            onChange={(e) => this.setState({value: e.target.value, error: null})}
                                            value={this.state.value}
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
                                show={!!this.state.error}
                                target={() => this.inputNode}
                                container={() => this.containerNode}
                                placement="top"
                                animation={false}
                            >
                                <Popover id="source-type-error-popover" className="text-danger">
                                    {this.state.error}
                                </Popover>
                            </Overlay>
                        </Panel>
                    </Col>
                </Row>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    settings: state.settings.data
});

const mapDispatchToProps = (dispatch) => ({

    onUpdate: (value) => {
        dispatch(updateSetting("allowed_source_types", value));
    },

    onToggle: (value) => {
        dispatch(updateSetting("restrict_source_types", value));
    }

});

const SourceTypesContainer = connect(mapStateToProps, mapDispatchToProps)(SourceTypes);

export default SourceTypesContainer;
