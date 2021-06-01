import { filter, find, get, map } from "lodash-es";
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

// This method takes selected read file's id and the list of read files
// The return value is the it's corresponding name without the file extension
const getFileNameFromId = (id, files) => {
    const file = find(files, file => file.id === id);
    return file ? file.name_on_disk.match(extensionRegex)[1] : "";
};

const validationSchema = Yup.object().shape({
    name: Yup.string().required("Required Field"),
    subtractionId: Yup.string().required("A default subtraction must be selected"),
    selected: Yup.array().min(1, "At least one read file must be attached to the sample")
});

//TODO: Add error message(s) for server responses
export const CreateSample = props => {
    const initialValues = {
        selected: [],
        name: "",
        isolate: "",
        host: "",
        locale: "",
        libraryType: "normal",
        selected: [],
        // Values below will be updated since they are dependent on props
        group: "",
        subtractionId: ""
    };

    // This function updates the initial values which are dependent on props
    const updateInitialValues = () => {
        initialValues.group = props.forceGroupChoice ? "None" : "";
        initialValues.subtractionId = get(props, "subtractions[0].id", "");
    };

    // Load the files on mount
    useEffect(() => {
        props.onLoadSubtractionsAndFiles();
    }, []);

    // Update Formik's initial values once the subtraction files have been received
    useEffect(() => {
        if (props.subtractions !== null || props.readyReads !== null) {
            updateInitialValues();
        }
    }, [props.subtractions, props.readyReads]);

    if (props.subtractions === null || props.readyReads === null) {
        return <LoadingPlaceholder margin="36px" />;
    }

    const subtractionComponents = map(props.subtractions, subtraction => (
        <option key={subtraction.id} value={subtraction.id}>
            {subtraction.name}
        </option>
    ));

    const changeGroup = (e, setValue) => {
        console.log(`changeGroup fired with: ${e.target.value} and: `, setValue);
        setGroup(e.target.value);
    };

    const autofill = (selected, setFieldValue, e) => {
        const fileName = getFileNameFromId(selected[0], props.readyReads);
        if (fileName) {
            setFieldValue("name", fileName);
        }
    };

    const handleSubmit = values => {
        console.log("The values received are: ", values);
        console.log("Correct location");
        // Get the values that are hooks
        //==============================//

        // Submit it
        //==============================//
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

    // TODO: There's no props.groups array
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
                validationSchema={validationSchema}
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
                                        name="name"
                                        autocomplete={false}
                                        error={touched.name ? errors.name : null}
                                    />
                                    <InputIcon
                                        name="magic"
                                        onClick={e => autofill(values.selected, setFieldValue, e)}
                                        disabled={!values.selected.length}
                                    />
                                </InputContainer>
                                {touched.name && <InputError>{errors.name}</InputError>}
                            </InputGroup>
                            <InputGroup>
                                <InputLabel>Locale</InputLabel>
                                <Field as={Input} name="locale" />
                            </InputGroup>
                            <InputGroup>
                                <InputLabel>Isolate</InputLabel>
                                <Field as={Input} name="isolate" />
                            </InputGroup>

                            <InputGroup>
                                <InputLabel>Default Subtraction</InputLabel>
                                <Field
                                    as={Select}
                                    name="subtractionId"
                                    error={touched.subtractionId ? errors.subtractionId : null}
                                    onChange={e => setFieldValue("subtractionId", e.value)}
                                >
                                    {subtractionComponents}
                                </Field>
                                {touched.name && <InputError>{errors.subtractionId}</InputError>}
                            </InputGroup>

                            <InputGroup>
                                <InputLabel>Host</InputLabel>
                                <Field as={Input} name="host" />
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
                        {props.forceGroupChoice && (
                            <Field
                                as={SampleUserGroup}
                                name="group"
                                group={props.group}
                                groups={props.groups}
                                onChange={e => changeGroup(e, setFieldValue)}
                            />
                        )}
                        <Field
                            name="selected"
                            as={ReadSelector}
                            files={props.readyReads}
                            selected={values.selected}
                            onSelect={selection => setFieldValue("selected", selection)}
                            error={touched.selected ? errors.selected : null}
                        />

                        <button type="button" onClick={() => console.log(values)}>
                            Print the values
                        </button>

                        <button type="button" onClick={() => console.log(errors)}>
                            Print the errors
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
