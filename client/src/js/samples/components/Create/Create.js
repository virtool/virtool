import { filter, get, map } from "lodash-es";
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

const StyledInputError = styled(InputError)`
    text-align: left;
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

const initialValues = {
    selected: [],
    name: "",
    isolate: "",
    host: "",
    locale: "",
    libraryType: "normal",
    select: [],
    // Values below will be updated on mount since they are dependent on props
    group: "",
    subtractionId: ""
};

//TODO: Add error message(s) for server responses
export const CreateSample = props => {
    // const [group, setGroup] = useState();

    // This function updates the initial values which are dependent on props
    const updateInitialValues = () => {
        initialValues.group = props.forceGroupChoice ? "None" : "";
        initialValues.subtractionId = get(props, "subtractions[0]", "");
    };

    useEffect(() => {
        props.onLoadSubtractionsAndFiles();
        updateInitialValues();
    }, []);

    if (props.subtractions === null || props.readyReads === null) {
        return <LoadingPlaceholder margin="36px" />;
    }

    // If there are no default subtractions, an error must be made
    const errorSubtraction =
        !props.subtractions || !props.subtractions.length
            ? "At least one subtraction must be added to Virtool before samples can be analyzed."
            : "";

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
        console.log("value: ", event.target.value);
        console.log("name: ", name);
        console.log("setValue: ", setValue);
        setValue(name, event.target.value);
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

    const handleSubmit = values => {
        console.log("The values received are: ", values);
        console.log("Correct location");
        // Get the values that are hooks
        //============

        // Submit it
        //===========
        const { name, isolate, host, locale, libraryType, subtractionId, selected } = values;
        // TODO: Handle the return and not close the page
        // if(!errorSubtraction){
        // props.onCreate(
        //     name,
        //     isolate,
        //     host,
        //     locale,
        //     libraryType,
        //     subtractionId, //|| get(this.props.subtractions, [0, "id"]),
        //     selected //this.state.selected
        // );
        // }
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

    // The name of the subtractionID from state must be renamed
    // const subtractionId = this.state.subtractionId || get(props.subtractions, [0, "id"]);
    return (
        <NarrowContainer>
            <ViewHeader title="Create Sample">
                <ViewHeaderTitle>Create Sample</ViewHeaderTitle>
                {errorSubtraction && <StyledInputError>{errorSubtraction}</StyledInputError>}
            </ViewHeader>
            <Formik
                onSubmit={handleSubmit}
                initialValues={initialValues}
                validationSchema={nameValidationSchema}
                enableReinitialize={true} // Reloads form on mount
            >
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

                            {/* TODO: Fix the selection defaulting */}
                            <InputGroup>
                                <InputLabel>Default Subtraction</InputLabel>
                                <Field
                                    as={Select}
                                    name="subtractionId"
                                    // value={values.subtractionId || props.subtractions[0]}
                                    onChange={e => updateValue(e, "subtractionId", setFieldValue)}
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
                            name={"libraryType"}
                            as={LibraryTypeSelector}
                            onSelect={library => setFieldValue("libraryType", library)}
                            libraryType={values.libraryType}
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
