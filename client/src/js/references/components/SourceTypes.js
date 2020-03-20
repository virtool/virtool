import { get, includes, map, toLower, without } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { updateSetting } from "../../administration/actions";
import {
    BoxGroup,
    BoxGroupHeader,
    BoxGroupSection,
    Checkbox,
    Icon,
    Input,
    InputContainer,
    InputError,
    InputGroup,
    InputIcon
} from "../../base";
import { editReference } from "../actions";

const StyledItem = styled(BoxGroupSection)`
    display: fle;
    justify-content: space-between;
`;

const SourceTypesTitle = styled.h2`
    display: flex;
    justify-content: space-between;
`;

const getInitialState = () => ({
    value: "",
    error: null
});

const globalDescription = `
    Configure a list of default source types. New references will automatically take these values as their allowed
    source types.
`;

const localDescription = `
    Configure a list of allowable source types. When a user creates a new isolate they will only be able to select a
    source type from this list. If this feature is disabled, users will be able to enter any string as a source
    type.
`;

export const SourceTypeItem = ({ onRemove, sourceType, disabled }) => (
    <StyledItem disabled={disabled}>
        <span className="text-capitalize">{sourceType}</span>
        <div>{disabled ? null : <Icon name="trash" color="red" onClick={() => onRemove(sourceType)} />}</div>
    </StyledItem>
);

const SourceTypesCheckbox = styled(Checkbox)`
    margin-left: auto;
    text-align: right;
`;

const SourceTypesInputGroup = styled(InputGroup)`
    margin: 0;
    min-height: 65px;
`;

export class SourceTypes extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState();
    }

    handleChange = e => {
        this.setState({ value: e.target.value, error: null });
    };

    handleRemove = sourceType => {
        this.props.onUpdate(without(this.props.sourceTypes, sourceType), this.props.global, this.props.refId);
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
                    error: "Source type already exists"
                });
            } else if (includes(newSourceType, " ")) {
                // Show error if the input string includes a space character.
                this.setState({
                    error: "Source types may not contain spaces"
                });
            } else {
                const newSourceTypes = this.props.sourceTypes.concat([newSourceType]);
                this.props.onUpdate(newSourceTypes, this.props.global, this.props.refId);
                this.setState(getInitialState());
            }
        }
    };

    render() {
        const disabled = !this.props.global && (this.props.remote || !this.props.restrictSourceTypes);

        let checkbox;

        if (!this.props.global && !this.props.remote) {
            checkbox = (
                <SourceTypesCheckbox
                    label="Enable"
                    checked={this.props.restrictSourceTypes}
                    onClick={this.handleEnable}
                />
            );
        }

        const listComponents = map(this.props.sourceTypes.sort(), sourceType => (
            <SourceTypeItem key={sourceType} onRemove={this.handleRemove} sourceType={sourceType} disabled={disabled} />
        ));

        const title = `${this.props.global ? "Default" : ""} Source Types`;

        return (
            <BoxGroup>
                <BoxGroupHeader>
                    <SourceTypesTitle>
                        <span>{title}</span>
                        {checkbox}
                    </SourceTypesTitle>
                    <p>{this.props.global ? globalDescription : localDescription}</p>
                </BoxGroupHeader>
                <BoxGroupSection as="form" onSubmit={this.handleSubmit}>
                    <SourceTypesInputGroup>
                        <InputContainer align="right">
                            <Input disabled={disabled} onChange={this.handleChange} value={this.state.value} />
                            <InputIcon bsStyle="primary" name="plus-circle" onClick={this.handleSubmit} />
                        </InputContainer>
                        <InputError>{this.state.error}</InputError>
                    </SourceTypesInputGroup>{" "}
                </BoxGroupSection>
                <React.Fragment>{listComponents}</React.Fragment>
            </BoxGroup>
        );
    }
}

const mapStateToProps = (state, { global = false }) => {
    const sourceTypes = global
        ? state.settings.data.default_source_types
        : get(state, "references.detail.source_types", []);

    const restrictSourceTypes = global
        ? state.settings.restrict_source_types
        : get(state, "references.detail.restrict_source_types", false);

    let refId;
    let remote = false;

    if (!global) {
        refId = get(state, "references.detail.id");
        remote = get(state, "references.detail.remotes_from");
    }

    return {
        global,
        restrictSourceTypes,
        refId,
        sourceTypes,
        remote
    };
};

export const mapDispatchToProps = dispatch => ({
    onUpdate: (value, global, refId) => {
        if (global) {
            dispatch(updateSetting("default_source_types", value));
        } else {
            dispatch(editReference(refId, { source_types: value }));
        }
    },

    onToggle: (refId, value) => {
        dispatch(editReference(refId, { restrict_source_types: value }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(SourceTypes);
