import { filter, get, map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { pushState } from "../../../app/actions";
import {
    DialogBody,
    DialogFooter,
    Input,
    InputContainer,
    InputError,
    InputGroup,
    InputIcon,
    InputLabel,
    LoadingPlaceholder,
    ModalDialog,
    SaveButton,
    Select
} from "../../../base";
import { clearError } from "../../../errors/actions";
import { listSubtractionIds } from "../../../subtraction/actions";
import { getFirstSubtractionId, getSubtractionIds } from "../../../subtraction/selectors";
import { getTargetChange, routerLocationHasState } from "../../../utils/utils";
import { createSample, findReadFiles } from "../../actions";
import { LibraryTypeSelection } from "./LibraryTypeSelection";
import ReadSelector from "./ReadSelector";
import { SampleUserGroup } from "./UserGroup";

const CreateSampleFields = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    grid-column-gap: 15px;
`;

const extensionRegex = /^[a-z0-9]+-(.*)\.f[aq](st)?[aq]?(\.gz)?$/;

const getFileNameFromId = id => id.match(extensionRegex)[1];

const getInitialState = props => ({
    selected: [],
    name: "",
    host: "",
    isolate: "",
    locale: "",
    subtraction: "",
    group: props.forceGroupChoice ? "none" : "",
    errorName: "",
    errorSubtraction: "",
    errorFile: "",
    libraryType: "normal"
});

export class CreateSample extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(props);
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        if (!prevState.errorName.length && !!nextProps.error) {
            return { errorName: nextProps.error };
        }

        return null;
    }

    handleHide = () => {
        this.props.onHide();
    };

    handleModalExited = () => {
        this.setState(getInitialState(this.props));
        if (this.props.error.length) {
            this.props.onClearError("CREATE_SAMPLE_ERROR");
        }
    };

    handleChange = e => {
        const { name, value, error } = getTargetChange(e.target);

        if (name === "name" || name === "subtraction") {
            this.setState({
                [name]: value,
                [error]: ""
            });
        } else {
            this.setState({
                [name]: value
            });
        }
    };

    handleLibrarySelect = libraryType => {
        this.setState({ libraryType });
    };

    handleSubmit = e => {
        e.preventDefault();

        let hasError = false;

        if (!this.state.name) {
            hasError = true;
            this.setState({ errorName: "Required Field" });
        }

        if (!this.props.subtractions || !this.props.subtractions.length) {
            hasError = true;
            this.setState({
                errorSubtraction: "At least one subtraction must be added to Virtool before samples can be analyzed."
            });
        }

        if (!this.state.selected.length) {
            hasError = true;
            this.setState({
                errorFile: "At least one read file must be attached to the sample"
            });
        }

        if (!hasError) {
            const { name, isolate, host, locale, libraryType, subtraction } = this.state;
            this.props.onCreate(
                name,
                isolate,
                host,
                locale,
                libraryType,
                subtraction || this.props.defaultSubtraction,
                this.state.selected
            );
        }
    };

    autofill = () => {
        if (this.state.selected.length) {
            this.setState({
                name: getFileNameFromId(this.state.selected[0])
            });
        }
    };

    handleSelect = selected => {
        this.setState({ selected, errorFile: "" });
    };

    render() {
        if (this.props.subtractions === null || this.props.readyReads === null) {
            return (
                <ModalDialog
                    label="sample"
                    size="lg"
                    show={this.props.show}
                    onHide={this.props.onHide}
                    onEnter={this.props.onLoadSubtractionsAndFiles}
                >
                    <DialogBody>
                        <LoadingPlaceholder margin="36px" />
                    </DialogBody>
                </ModalDialog>
            );
        }

        const subtractionComponents = map(this.props.subtractions, subtractionId => (
            <option key={subtractionId} value={subtractionId}>
                {subtractionId}
            </option>
        ));

        const userGroup = this.props.forceGroupChoice ? (
            <SampleUserGroup
                group={this.props.group}
                groups={this.props.groups}
                onChange={e => this.setState({ group: e })}
            />
        ) : null;

        const pairedness = this.state.selected.length === 2 ? "Paired" : "Unpaired";

        const { errorName, errorSubtraction, errorFile } = this.state;

        return (
            <ModalDialog
                headerText="Create Sample"
                label="sample"
                size="lg"
                show={this.props.show}
                onHide={this.handleHide}
                onEnter={this.props.onLoadSubtractionsAndFiles}
                onExited={this.handleModalExited}
            >
                <form onSubmit={this.handleSubmit}>
                    <DialogBody>
                        <CreateSampleFields>
                            <InputGroup>
                                <InputLabel>Sample Name</InputLabel>
                                <InputContainer align="right">
                                    <Input
                                        error={errorName}
                                        name="name"
                                        value={this.state.name}
                                        onChange={this.handleChange}
                                        autocomplete={false}
                                    />
                                    <InputIcon
                                        name="magic"
                                        onClick={this.autofill}
                                        disabled={!this.state.selected.length}
                                    />
                                </InputContainer>
                                <InputError>{errorName}</InputError>
                            </InputGroup>
                            <InputGroup>
                                <InputLabel>Locale</InputLabel>
                                <Input name="locale" value={this.state.locale} onChange={this.handleChange} />
                            </InputGroup>
                            <InputGroup>
                                <InputLabel>Isolate</InputLabel>
                                <Input name="isolate" value={this.state.isolate} onChange={this.handleChange} />
                            </InputGroup>
                            <InputGroup>
                                <InputLabel>Default Subtraction</InputLabel>
                                <Select
                                    name="subtraction"
                                    value={this.state.subtraction || this.props.defaultSubtraction}
                                    onChange={this.handleChange}
                                >
                                    {subtractionComponents}
                                </Select>
                                <InputError>{errorSubtraction}</InputError>
                            </InputGroup>

                            <InputGroup>
                                <InputLabel>Host</InputLabel>
                                <Input name="host" value={this.state.host} onChange={this.handleChange} />
                            </InputGroup>

                            <InputGroup>
                                <InputLabel>Pairedness</InputLabel>
                                <Input value={pairedness} readOnly={true} />
                            </InputGroup>
                        </CreateSampleFields>

                        <LibraryTypeSelection
                            onSelect={this.handleLibrarySelect}
                            libraryType={this.state.libraryType}
                        />

                        {userGroup}

                        <ReadSelector
                            files={this.props.readyReads}
                            selected={this.state.selected}
                            onSelect={this.handleSelect}
                            error={errorFile}
                        />
                    </DialogBody>

                    <DialogFooter>
                        <SaveButton />
                    </DialogFooter>
                </form>
            </ModalDialog>
        );
    }
}

export const mapStateToProps = state => ({
    defaultSubtraction: getFirstSubtractionId(state),
    error: get(state, "errors.CREATE_SAMPLE_ERROR.message", ""),
    forceGroupChoice: state.settings.sample_group === "force_choice",
    groups: state.account.groups,
    readyReads: filter(state.samples.readFiles, { reserved: false }),
    show: routerLocationHasState(state, "createSample"),
    subtractions: getSubtractionIds(state)
});

export const mapDispatchToProps = dispatch => ({
    onLoadSubtractionsAndFiles: () => {
        dispatch(listSubtractionIds());
        dispatch(findReadFiles());
    },

    onCreate: (name, isolate, host, locale, libraryType, subtraction, files) => {
        dispatch(createSample(name, isolate, host, locale, libraryType, subtraction, files));
    },

    onHide: () => {
        dispatch(pushState({ create: false }));
    },

    onClearError: error => {
        dispatch(clearError(error));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(CreateSample);
