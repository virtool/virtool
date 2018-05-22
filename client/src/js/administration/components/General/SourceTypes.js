import React from "react";
import { includes, map, toLower, without } from "lodash-es";
import { connect } from "react-redux";
import { Row, Col, Panel, FormGroup, InputGroup, FormControl } from "react-bootstrap";

import { Flex, FlexItem, Icon, Button, Checkbox, ListGroupItem } from "../../../base";
import { editReference } from "../../../references/actions";
import { updateSetting } from "../../actions";

const getInitialState = () => ({
    value: "",
    error: null
});

const SourceTypeItem = ({ onRemove, sourceType, restrictSourceTypes }) => (
    <ListGroupItem key={sourceType} disabled={!restrictSourceTypes}>
        <span className="text-capitalize">{sourceType}</span>
        {restrictSourceTypes ? <Icon name="trash" bsStyle="danger" onClick={() => onRemove(sourceType)} pullRight /> : null}
    </ListGroupItem>
);

class SourceTypes extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    remove = (sourceType) => {
        this.props.onUpdate(without(this.props.default_source_types, sourceType));
    };

    handleEnable = () => {
        this.props.onToggle(this.props.refId, !this.props.restrict_source_types);
    };

    handleSubmit = (e) => {
        e.preventDefault();

        // Do nothing if the sourceType is an empty string.
        if (this.state.value !== "") {
            // Convert source type to lowercase. All source types are single words stored in lowercase. They are
            // capitalized when rendered in the application.
            const newSourceType = toLower(this.state.value);

            if (includes(this.props.default_source_types, newSourceType)) {
                // Show error if the source type already exists in the list.
                this.setState({
                    error: "Source type already exists."
                });
            } else if (includes(newSourceType, " ")) {
                // Show error if the input string includes a space character.
                this.setState({
                    error: "Source types may not contain spaces."
                });
            } else {
                const newSourceTypes = this.props.default_source_types.concat([newSourceType]);
                this.props.onUpdate(newSourceTypes);
                this.setState(getInitialState());
            }
        }
    };

    render () {

        const restrictSourceTypes = this.props.restrict_source_types;

        const listComponents = map(this.props.default_source_types.sort(), sourceType =>
            <SourceTypeItem
                key={sourceType}
                onRemove={this.remove}
                sourceType={sourceType}
                restrictSourceTypes={restrictSourceTypes}
            />
        );

        const errorMessage = (
            <div className={this.state.error ? "input-form-error" : "input-form-error-none"}>
                <span className="input-error-message">{this.state.error ? this.state.error : "None"}</span>
            </div>
        );

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
                                    onClick={this.handleEnable}
                                />
                            </FlexItem>
                        </Flex>
                    </Col>

                    <Col smHidden md={6} />
                </Row>
                <Row>
                    <Col xs={12} md={6} mdPush={6}>
                        <Panel>
                            <Panel.Body>
                                Configure a list of allowable source types. When a user creates a new isolate they will
                                only be able to select a source type from this list. If this feature is disabled, users
                                will be able to enter any string as a source type.
                            </Panel.Body>
                        </Panel>
                    </Col>
                    <Col xs={12} md={6} mdPull={6}>
                        <Panel>
                            <Panel.Body>
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
                                                    <Icon name="plus-square" style={{paddingLeft: "3px"}} />
                                                </Button>
                                            </InputGroup.Button>
                                        </InputGroup>
                                        {errorMessage}
                                    </FormGroup>
                                </form>

                                <div>
                                    {listComponents}
                                </div>
                            </Panel.Body>
                        </Panel>
                    </Col>
                </Row>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const { default_source_types } = state.settings.data;
    const { restrict_source_types, id } = state.references.detail;

    return {
        default_source_types,
        restrict_source_types,
        refId: id
    };
};

const mapDispatchToProps = (dispatch) => ({

    onUpdate: (value) => {
        dispatch(updateSetting("default_source_types", value));
    },

    onToggle: (refId, value) => {
        const update = { restrict_source_types: value };
        dispatch(editReference(refId, update));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(SourceTypes);
