import { filter, get, map, values } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import {
    Input,
    InputContainer,
    InputError,
    InputGroup,
    InputIcon,
    InputLabel,
    LoadingPlaceholder,
    NarrowContainer,
    SaveButton,
    Select,
    ViewHeader,
    ViewHeaderTitle
} from "../../../base";
import { clearError } from "../../../errors/actions";
import { shortlistSubtractions } from "../../../subtraction/actions";
import { getSubtractionShortlist } from "../../../subtraction/selectors";
import { getTargetChange } from "../../../utils/utils";
import { createSample, findReadFiles } from "../../actions";
import { LibraryTypeSelector } from "./LibraryTypeSelector";
import ReadSelector from "./ReadSelector";
import { SampleUserGroup } from "./UserGroup";
import { Formik, Form, Field } from "formik";

const CreateSampleFields = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    grid-column-gap: ${props => props.theme.gap.column};
`;

const extensionRegex = /^[a-z0-9]+-(.*)\.f[aq](st)?[aq]?(\.gz)?$/;

const getFileNameFromId = id => id.match(extensionRegex)[1];

const getInitialState = props => ({
    selected: [],
    name: "",
    host: "",
    isolate: "",
    locale: "",
    subtractionId: "",
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

    componentDidMount = () => {
        this.props.onLoadSubtractionsAndFiles();
    };

    handleChange = e => {
        const { name, value, error } = getTargetChange(e.target);

        if (name === "name" || name === "subtractionId") {
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

    handleSubmit = values => {
        console.log("TEST!!!");
        console.log("The values are: ", values);
        console.log("The state is: ", this.state);
        //e.preventDefault();

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
            const { name, isolate, host, locale, libraryType, subtractionId } = this.state;
            // this.props.onCreate(
            //     name,
            //     isolate,
            //     host,
            //     locale,
            //     libraryType,
            //     subtractionId || get(this.props.subtractions, [0, "id"]),
            //     this.state.selected
            // );
            console.log("The submission was successful");
        } else {
            console.log("There is an error in submitting", this.state);
        }
        console.log(this.state);
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
            return <LoadingPlaceholder margin="36px" />;
        }

        const subtractionComponents = map(this.props.subtractions, subtraction => (
            <option key={subtraction.id} value={subtraction.id}>
                {subtraction.name}
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

        const { errorName, errorFile } = this.state;

        const subtractionId = this.state.subtractionId || get(this.props.subtractions, [0, "id"]);
        return (
            <NarrowContainer>
                <ViewHeader title="Create Sample">
                    <ViewHeaderTitle>Create Sample</ViewHeaderTitle>
                </ViewHeader>
                <Formik onSubmit={this.handleSubmit}>
                    <Form>
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
                                <Select name="subtractionId" value={subtractionId} onChange={this.handleChange}>
                                    {subtractionComponents}
                                </Select>
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

                        <LibraryTypeSelector onSelect={this.handleLibrarySelect} libraryType={this.state.libraryType} />

                        {userGroup}

                        <ReadSelector
                            files={this.props.readyReads}
                            selected={this.state.selected}
                            onSelect={this.handleSelect}
                            error={errorFile}
                        />
                        <SaveButton />
                    </Form>
                </Formik>
            </NarrowContainer>
        );
    }
}

export const mapStateToProps = state => ({
    error: get(state, "errors.CREATE_SAMPLE_ERROR.message", ""),
    forceGroupChoice: state.settings.sample_group === "force_choice",
    groups: state.account.groups,
    readyReads: filter(state.samples.readFiles, { reserved: false }),
    subtractions: getSubtractionShortlist(state)
});

export const mapDispatchToProps = dispatch => ({
    onLoadSubtractionsAndFiles: () => {
        dispatch(shortlistSubtractions());
        dispatch(findReadFiles());
    },

    onCreate: (name, isolate, host, locale, libraryType, subtractionId, files) => {
        dispatch(createSample(name, isolate, host, locale, libraryType, subtractionId, files));
    },

    onClearError: () => {
        dispatch(clearError("CREATE_SAMPLE_ERROR"));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(CreateSample);
