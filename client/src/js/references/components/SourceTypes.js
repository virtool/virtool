import React from "react";
import { includes, map, toLower, without, get } from "lodash-es";
import { connect } from "react-redux";
import { Panel, FormGroup, InputGroup, FormControl, ListGroup } from "react-bootstrap";
import { Icon, Button, Checkbox, ListGroupItem } from "../../base/index";
import { editReference } from "../actions";
import { updateSetting } from "../../administration/actions";

const getInitialState = () => ({
    value: "",
    error: null
});

export const SourceTypeItem = ({ onRemove, sourceType, isDisabled }) => (
    <ListGroupItem key={sourceType} disabled={!isDisabled}>
        <span className="text-capitalize">{sourceType}</span>
        {isDisabled ? <Icon name="trash" bsStyle="danger" onClick={() => onRemove(sourceType)} pullRight /> : null}
    </ListGroupItem>
);

export class SourceTypes extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState();
    }

    remove = sourceType => {
        this.props.onUpdate(without(this.props.sourceTypes, sourceType), this.props.isGlobalSettings, this.props.refId);
    };

    handleEnable = () => {
        if (this.props.refId) {
            this.props.onToggle(this.props.refId, !this.props.restrictSourceTypes);
        }
    };

    handleSubmit = e => {
        e.preventDefault();

        // Do nothing if the sourceType is an empty string.
        if (this.state.value !== "") {
            // Convert source type to lowercase. All source types are single words stored in lowercase. They are
            // capitalized when rendered in the application.
            const newSourceType = toLower(this.state.value);

            if (includes(this.props.sourceTypes, newSourceType)) {
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
                const newSourceTypes = this.props.sourceTypes.concat([newSourceType]);
                this.props.onUpdate(newSourceTypes, this.props.isGlobalSettings, this.props.refId);
                this.setState(getInitialState());
            }
        }
    };

    render() {
        let isDisabled = (this.props.isGlobalSettings && this.props.isAdmin) || this.props.restrictSourceTypes;
        isDisabled = this.props.isRemote ? false : isDisabled;

        let checkbox;

        if (!this.props.global && !this.props.isRemote) {
            checkbox = (
                <Checkbox
                    label="Enable"
                    checked={this.props.restrictSourceTypes}
                    onClick={this.handleEnable}
                    pullRight
                />
            );
        }

        const listComponents = map(this.props.sourceTypes.sort(), sourceType => (
            <SourceTypeItem key={sourceType} onRemove={this.remove} sourceType={sourceType} isDisabled={isDisabled} />
        ));

        const errorMessage = (
            <div className={this.state.error ? "input-form-error" : "input-form-error-none"}>
                <span className="input-error-message">{this.state.error ? this.state.error : "None"}</span>
            </div>
        );

        return (
            <Panel>
                <ListGroup>
                    <ListGroupItem>
                        <strong>Source Types</strong>
                        {checkbox}
                    </ListGroupItem>
                    <ListGroupItem>
                        Configure a list of allowable source types. When a user creates a new isolate they will only be
                        able to select a source type from this list. If this feature is disabled, users will be able to
                        enter any string as a source type.
                    </ListGroupItem>
                    <ListGroupItem>
                        <form onSubmit={this.handleSubmit}>
                            <FormGroup>
                                <InputGroup ref={node => (this.containerNode = node)}>
                                    <FormControl
                                        type="text"
                                        inputRef={node => (this.inputNode = node)}
                                        disabled={!isDisabled}
                                        onChange={e => this.setState({ value: e.target.value, error: null })}
                                        value={this.state.value}
                                    />
                                    <InputGroup.Button>
                                        <Button type="submit" bsStyle="primary" disabled={!isDisabled}>
                                            <Icon name="plus-square" style={{ paddingLeft: "3px" }} />
                                        </Button>
                                    </InputGroup.Button>
                                </InputGroup>
                                {errorMessage}
                            </FormGroup>
                        </form>
                        <div>{listComponents}</div>
                    </ListGroupItem>
                </ListGroup>
            </Panel>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const global = ownProps.global;

    const sourceTypes = global
        ? state.settings.data.default_source_types
        : get(state, "references.detail.source_types", []);

    const restrictSourceTypes = global
        ? state.settings.restrict_source_types
        : get(state, "references.detail.restrict_source_types", false);

    let refId;
    let isRemote;

    if (!global) {
        refId = get(state, "references.detail.id");
        isRemote = get(state, "references.detailremotes_from");
    }

    return {
        isAdministrator: state.account.administrator,
        global,
        restrictSourceTypes,
        refId,
        sourceTypes,
        isRemote
    };
};

const mapDispatchToProps = dispatch => ({
    onUpdate: (value, isGlobal, refId) => {
        if (isGlobal) {
            dispatch(updateSetting("default_source_types", value));
        } else {
            dispatch(editReference(refId, { source_types: value }));
        }
    },

    onToggle: (refId, value) => {
        dispatch(editReference(refId, { restrict_source_types: value }));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(SourceTypes);
