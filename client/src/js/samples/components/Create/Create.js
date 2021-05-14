import { filter, get, map, values } from "lodash-es";
import React, { useEffect, useState } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Formik, Form, Field } from "formik";
import * as Yup from "yup";
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

//TODO: Check what type the subtraction actually is
const validationSchema = Yup.object().shape({
    name: Yup.string().required("Required"),
    subtraction: Yup.string().required(
        "At least one subtraction must be added to Virtool before samples can be analyzed."
    ),
    selected: Yup.array //.length(1, "At least one read file must be attached to the sample")
});

const nameValidationSchema = Yup.object().shape({
    name: Yup.string().required("Required")
});

const initialValues = { selected: [], name: "", host: "", isolate: "", locale: "", subtractionId: "" };

export const CreateSample = props => {
    const [selected, setSelected] = useState([]);
    const [name, setName] = useState("");
    const [host, setHost] = useState("");
    const [isolate, setIsolate] = useState("");
    const [locale, setLocale] = useState("");
    const [subtractionId, setSubtractionId] = useState("");
    const [group, setGroup] = useState(props.forceGroupChoice ? "none" : "");
    const [errorName, setErrorName] = useState("");
    const [errorSubtraction, setErrorSubtraction] = useState("");
    const [errorFile, setErrorFile] = useState("");
    const [libraryType, setLibraryType] = useState("normal");

    // Don't know why nextProps is being double negated or if this is still actually needed
    // getDerivedStateFromProps(nextProps, prevState) {
    //     if (!prevState.errorName.length && !!nextProps.error) {
    //         return { errorName: nextProps.error };
    //     }

    //     return null;
    // }

    useEffect(() => {
        props.onLoadSubtractionsAndFiles();
    }, []);

    const handleLibrarySelect = newLibraryType => {
        setLibraryType(newLibraryType);
    };

    // Temporary handleSubmit
    const handleSubmit = values => console.log("The values received were: ", values);

    // const handleSubmit = values => {
    //     console.log("TEST!!!");
    //     console.log("The values are: ", values);
    //     console.log("The state is: ", this.state);
    //     //e.preventDefault();

    //     let hasError = false;

    //     if (!this.state.name) {
    //         hasError = true;
    //         this.setState({ errorName: "Required Field" });
    //     }

    //     if (!props.subtractions || !props.subtractions.length) {
    //         hasError = true;
    //         this.setState({
    //             errorSubtraction: "At least one subtraction must be added to Virtool before samples can be analyzed."
    //         });
    //     }

    //     if (!this.state.selected.length) {
    //         hasError = true;
    //         this.setState({
    //             errorFile: "At least one read file must be attached to the sample"
    //         });
    //     }

    //     if (!hasError) {
    //         const { name, isolate, host, locale, libraryType, subtractionId } = this.state;
    //         // props.onCreate(
    //         //     name,
    //         //     isolate,
    //         //     host,
    //         //     locale,
    //         //     libraryType,
    //         //     subtractionId || get(props.subtractions, [0, "id"]),
    //         //     this.state.selected
    //         // );
    //         console.log("The submission was successful");
    //     } else {
    //         console.log("There is an error in submitting", this.state);
    //     }
    //     console.log(this.state);
    // };

    // const autofill = () => {
    //     if (this.state.selected.length) {
    //         this.setState({
    //             name: getFileNameFromId(this.state.selected[0])
    //         });
    //     }
    // };

    if (props.subtractions === null || props.readyReads === null) {
        return <LoadingPlaceholder margin="36px" />;
    } else {
        const subtractionComponents = map(props.subtractions, subtraction => (
            <option key={subtraction.id} value={subtraction.id}>
                {subtraction.name}
            </option>
        ));

        const userGroup = props.forceGroupChoice ? (
            <SampleUserGroup group={props.group} groups={props.groups} onChange={e => setGroup(e)} />
        ) : null;

        const pairedness = selected.length === 2 ? "Paired" : "Unpaired";

        // const { errorName, errorFile } = this.state;

        // The name of the subtractionID from state must be renamed
        // const subtractionId = this.state.subtractionId || get(props.subtractions, [0, "id"]);
        return (
            <NarrowContainer>
                <ViewHeader title="Create Sample">
                    <ViewHeaderTitle>Create Sample</ViewHeaderTitle>
                </ViewHeader>
                <Formik onSubmit={handleSubmit} initialValues={initialValues} validationSchema={nameValidationSchema}>
                    {({ errors, touched }) => (
                        <Form>
                            <CreateSampleFields>
                                <InputGroup>
                                    <InputLabel>Sample Name</InputLabel>
                                    <InputContainer align="right">
                                        <Field
                                            as={Input}
                                            // error={errorName}
                                            name="name"
                                            // value={this.state.name}
                                            // onChange={this.handleChange}
                                            autocomplete={false}
                                        />
                                        <InputIcon
                                            name="magic"
                                            // onClick={this.autofill}
                                            // onClick={() => console.log("magic icon was pressed")}
                                            disabled={!selected.length}
                                        />
                                    </InputContainer>
                                    {errors.name && touched.name && <InputError>{errors.name}</InputError>}
                                </InputGroup>
                                <InputGroup>
                                    <InputLabel>Locale</InputLabel>
                                    <Field
                                        as={Input}
                                        name="locale"
                                        // value={this.state.locale}
                                        // onChange={this.handleChange}
                                    />
                                </InputGroup>
                                <InputGroup>
                                    <InputLabel>Isolate</InputLabel>
                                    <Field
                                        as={Input}
                                        name="isolate"
                                        // value={this.state.isolate}
                                        // onChange={this.handleChange}
                                    />
                                </InputGroup>

                                <InputGroup>
                                    <InputLabel>Default Subtraction</InputLabel>
                                    <Field
                                        as={Select}
                                        name="subtractionId"
                                        //value={subtractionId}
                                        //onChange={this.handleChange}
                                    >
                                        {subtractionComponents}
                                    </Field>
                                </InputGroup>

                                <InputGroup>
                                    <InputLabel>Host</InputLabel>
                                    <Field
                                        as={Input}
                                        name="host"
                                        // value={this.state.host}
                                        // onChange={this.handleChange}
                                    />
                                </InputGroup>

                                <InputGroup>
                                    <InputLabel>Pairedness</InputLabel>
                                    <Field as={Input} name={"pairedness"} readOnly={true} value={pairedness} />
                                </InputGroup>
                            </CreateSampleFields>

                            <Field
                                name={"librarySelector"}
                                as={LibraryTypeSelector}
                                onSelect={handleLibrarySelect}
                                libraryType={libraryType}
                            />

                            {/* TODO: Add a fake user group for testing purposes */}
                            {userGroup}

                            {/* 
                                Currently causing the application to crash due to the error:
                                ```
                                TypeError: prevProps.onSelect is not a function at 
                                ReadSelector.componentDidUpdate (ReadSelector.js:61)
                                ```
                            */}
                            {/* <ReadSelector
                                files={props.readyReads}
                                selected={selected}
                                //onSelect={this.handleSelect}
                                //error={errorFile}
                            /> */}

                            <SaveButton />
                        </Form>
                    )}
                </Formik>
            </NarrowContainer>
        );
    }
};

export const mapStateToProps = state => ({
    error: get(state, "errors.CREATE_SAMPLE_ERROR.message", ""),
    forceGroupChoice: state.settings.data.sample_group === "force_choice",
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
