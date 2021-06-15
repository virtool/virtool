import { filter, find, get, map } from "lodash-es";
import React, { useEffect } from "react";
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

/**
 * Gets a filename without extension, given the file ID and an array of all available read files.
 * Used to autofill the name for a new sample based on the selected read file(s).
 *
 * @param {Number} id - the file ID
 * @param {Array} files - all available read files
 * @returns {*|string} the filename without its extension
 */
const getFileNameFromId = (id, files) => {
    const file = find(files, file => file.id === id);
    return file ? file.name_on_disk.match(extensionRegex)[1] : "";
};

const validationSchema = Yup.object().shape({
    name: Yup.string().required("Required Field"),
    subtractionId: Yup.string().required("A default subtraction must be selected"),
    selected: Yup.array().min(1, "At least one read file must be attached to the sample")
});

export const CreateSample = props => {
    useEffect(props.onLoadSubtractionsAndFiles, []);

    if (props.subtractions === null || props.readyReads === null) {
        return <LoadingPlaceholder margin="36px" />;
    }

    const initialValues = {
        selected: [],
        name: "",
        isolate: "",
        host: "",
        locale: "",
        libraryType: "normal",
        group: props.forceGroupChoice ? "none" : "",
        subtractionId: get(props, "subtractions[0].id", "")
    };

    const subtractionComponents = map(props.subtractions, subtraction => (
        <option key={subtraction.id} value={subtraction.id}>
            {subtraction.name}
        </option>
    ));

    const autofill = (selected, setFieldValue) => {
        const fileName = getFileNameFromId(selected[0], props.readyReads);
        if (fileName) {
            setFieldValue("name", fileName);
        }
    };

    const handleSubmit = values => {
        const { name, isolate, host, locale, libraryType, subtractionId, selected } = values;
        props.onCreate(
            name,
            isolate,
            host,
            locale,
            libraryType,
            subtractionId || get(props.subtractions, [0, "id"]),
            selected
        );
    };

    return (
        <NarrowContainer>
            <ViewHeader title="Create Sample">
                <ViewHeaderTitle>Create Sample</ViewHeaderTitle>
                <StyledInputError>{props.error}</StyledInputError>
            </ViewHeader>
            <Formik onSubmit={handleSubmit} initialValues={initialValues} validationSchema={validationSchema}>
                {({ errors, setFieldValue, touched, values }) => (
                    <Form>
                        <CreateSampleFields>
                            <InputGroup>
                                <InputLabel>Sample Name</InputLabel>
                                <InputContainer align="right">
                                    <Field
                                        as={Input}
                                        type="text"
                                        name="name"
                                        aria-label="Sample Name"
                                        autocomplete={false}
                                        error={touched.name ? errors.name : null}
                                    />
                                    <InputIcon
                                        name="magic"
                                        data-testid="Auto Fill"
                                        onClick={e => autofill(values.selected, setFieldValue, e)}
                                        disabled={!values.selected.length}
                                    />
                                </InputContainer>
                                {touched.name && <InputError>{errors.name}</InputError>}
                            </InputGroup>

                            <InputGroup>
                                <InputLabel>Locale</InputLabel>
                                <Field as={Input} name="locale" aria-label="Locale" />
                            </InputGroup>

                            <InputGroup>
                                <InputLabel>Isolate</InputLabel>
                                <Field as={Input} name="isolate" aria-label="Isolate" />
                            </InputGroup>

                            <InputGroup>
                                <InputLabel>Default Subtraction</InputLabel>
                                <Field
                                    as={Select}
                                    name="subtractionId"
                                    aria-label="Default Subtraction"
                                    error={touched.subtractionId ? errors.subtractionId : null}
                                    onChange={e => setFieldValue("subtractionId", e.target.value)}
                                >
                                    {subtractionComponents}
                                </Field>
                                {touched.name && <InputError>{errors.subtractionId}</InputError>}
                            </InputGroup>

                            <InputGroup>
                                <InputLabel>Host</InputLabel>
                                <Field as={Input} name="host" aria-label="Host" />
                            </InputGroup>

                            <InputGroup>
                                <InputLabel>Pairedness</InputLabel>
                                <Field
                                    as={Input}
                                    name="pairedness"
                                    aria-label="Pairedness"
                                    readOnly={true}
                                    value={values.selected.length === 2 ? "Paired" : "Unpaired"}
                                />
                            </InputGroup>
                        </CreateSampleFields>

                        <Field
                            name="libraryType"
                            as={LibraryTypeSelector}
                            onSelect={library => setFieldValue("libraryType", library)}
                            libraryType={values.libraryType}
                        />

                        {props.forceGroupChoice && (
                            <Field
                                as={SampleUserGroup}
                                aria-label="User Group"
                                name="group"
                                group={values.group}
                                groups={props.groups}
                                onChange={e => setFieldValue("group", e.target.value)}
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
                        <SaveButton />
                    </Form>
                )}
            </Formik>
        </NarrowContainer>
    );
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
