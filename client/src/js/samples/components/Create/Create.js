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
//TODO: Add proper file selected validation
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

const initialValues = { selected: [], name: "", host: "", isolate: "", locale: "", subtractionId: "", select: [] };

//TODO: Add error message(s) for server responses
export const CreateSample = props => {
    const [subtractionId, setSubtractionId] = useState("");
    const [group, setGroup] = useState(props.forceGroupChoice ? "None" : "");
    const [libraryType, setLibraryType] = useState("normal");

    useEffect(() => {
        props.onLoadSubtractionsAndFiles();
    }, []);

    useEffect(() => {
        console.log("state = ", props.state);
    }, [props.state]);

    useEffect(() => {
        console.log("group = ", group);
    }, [group]);

    if (props.subtractions === null || props.readyReads === null) {
        return <LoadingPlaceholder margin="36px" />;
    }

    const handleLibrarySelect = newLibraryType => {
        setLibraryType(newLibraryType);
    };

    // Temporary handleSubmit
    const handleSubmit = values => console.log("The values received were: ", values);

    const subtractionComponents = map(props.subtractions, subtraction => (
        <option key={subtraction.id} value={subtraction.id}>
            {subtraction.name}
        </option>
    ));

    const changeGroup = (e, setValue) => {
        console.log(`changeGroup fired with: ${e.target.value} and: `, setValue);
        setGroup(e.target.value);
    };

    const updateValue = (event, name, setValue) => {
        console.log("value: ", value);
        console.log("name: ", name);
        console.log("setValue: ", setValue);
    };

    const handleSelect = (newValue, name, setValue) => setValue(name, newValue);

    // TODO: Figure out how to make Formik values get sent in this function
    const autofill = (selected, setValue, e) => {
        console.log("AutoFill was called");

        setValue("name", "Testing Name");

        if (selected.length) {
            console.log("... and filling name");
            setValue("name", selected[0]);
        }
    };

    //TODO: There's no props.groups array
    // const userGroup = props.forceGroupChoice ? (
    //     <SampleUserGroup
    //         name="group"
    //         group={props.group}
    //         groups={["Option 1", "Option 2", "Option 3"]} //props.groups}
    //         onChange={changeGroup}
    //         // onSelect={changeGroup}
    //     />
    // ) : null;

    // const userGroup = (
    //     <Field
    //         name="group"
    //         as={SampleUserGroup}
    //         // error={errorName}
    //         group={props.group}
    //         groups={["Option 1", "Option 2", "Option 3"]}
    //         handleChange={changeGroup}

    //         // value={this.state.name}
    //         // onChange={this.handleChange}
    //     />
    // );

    // The name of the subtractionID from state must be renamed
    // const subtractionId = this.state.subtractionId || get(props.subtractions, [0, "id"]);
    return (
        <NarrowContainer>
            <ViewHeader title="Create Sample">
                <ViewHeaderTitle>Create Sample</ViewHeaderTitle>
            </ViewHeader>
            <Formik onSubmit={handleSubmit} initialValues={initialValues} validationSchema={nameValidationSchema}>
                {({ errors, touched, setFieldValue, values }) => (
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
                                        onClick={e => autofill(values, setFieldValue, e)}
                                        // onClick={() => console.log("magic icon was pressed")}
                                        disabled={!values.selected.length}
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
                                    onChange={handleChange}
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
                                <Field
                                    as={Input}
                                    name={"pairedness"}
                                    readOnly={true}
                                    value={values.selected.length === 2 ? "Paired" : "Unpaired"}
                                />
                            </InputGroup>
                        </CreateSampleFields>
                        <Field
                            name={"librarySelector"}
                            as={LibraryTypeSelector}
                            onSelect={handleLibrarySelect}
                            libraryType={libraryType}
                        />
                        {/* TODO: Add a fake user group for testing purposes */}
                        {props.forceGroupChoice && (
                            <Field
                                as={SampleUserGroup}
                                name="group"
                                // error={errorName}
                                group={props.group}
                                groups={["Option 1", "Option 2", "Option 3"]}
                                onChange={e => changeGroup(e, setFieldValue)}
                            />
                        )}

                        {/* {userGroup} */}

                        {/* 
                                Currently causing the application to crash due to the error:
                                ```
                                TypeError: prevProps.onSelect is not a function at 
                                ReadSelector.componentDidUpdate (ReadSelector.js:61)
                                ```
                            */}
                        <Field
                            name="selected"
                            as={ReadSelector}
                            files={props.readyReads}
                            selected={values.selected}
                            onSelect={selection => handleSelect(selection, "selected", setFieldValue)}
                            //error={errorFile}
                        />
                        <button type="button" onClick={() => alert(JSON.stringify(values))}>
                            Print the values
                        </button>

                        <SaveButton />
                    </Form>
                )}
            </Formik>
        </NarrowContainer>
    );
};

export const mapStateToProps = state => ({
    error: get(state, "errors.CREATE_SAMPLE_ERROR.message", ""),
    forceGroupChoice: get(state, "settings.data.sample_group", "") === "force_choice",
    groups: state.account.groups,
    readyReads: filter(state.samples.readFiles, { reserved: false }),
    subtractions: getSubtractionShortlist(state),
    state: state
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
