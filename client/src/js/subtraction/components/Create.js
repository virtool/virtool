import { Field, Form, Formik } from "formik";
import { filter } from "lodash-es";
import React, { useEffect } from "react";
import { connect } from "react-redux";
import * as Yup from "yup";
import {
    Input,
    InputError,
    InputGroup,
    InputLabel,
    LoadingPlaceholder,
    SaveButton,
    ViewHeader,
    ViewHeaderTitle
} from "../../base";

import { findFiles } from "../../files/actions";
import { createSubtraction } from "../actions";
import SubtractionFileSelector from "./FileSelector";

const validationSchema = Yup.object().shape({
    name: Yup.string().required("A name is required"),
    uploadId: Yup.string().required("Please select a file")
});

export const CreateSubtraction = ({ onListFiles, onCreate, files }) => {
    useEffect(onListFiles, []);

    if (!files) {
        return <LoadingPlaceholder margin="36px" />;
    }

    const initialValues = {
        name: "",
        nickname: "",
        uploadId: ""
    };

    const handleSubmit = ({ uploadId, name, nickname }) => {
        onCreate({ uploadId, name, nickname });
    };

    return (
        <React.Fragment>
            <ViewHeader title="Create Subtraction">
                <ViewHeaderTitle>Create Subtraction</ViewHeaderTitle>
            </ViewHeader>
            <Formik initialValues={initialValues} onSubmit={handleSubmit} validationSchema={validationSchema}>
                {({ errors, setFieldValue, touched }) => (
                    <Form>
                        <InputGroup>
                            <InputLabel>Name</InputLabel>
                            <Field
                                aria-label={"name"}
                                as={Input}
                                name="name"
                                type="text"
                                error={touched.name ? errors.name : null}
                            />
                            {touched.name && <InputError>{errors.name}</InputError>}
                        </InputGroup>

                        <InputGroup>
                            <InputLabel>Nickname</InputLabel>
                            <Field aria-label={"nickname"} as={Input} name="nickname" type="text" />
                        </InputGroup>

                        <label>Files</label>
                        <Field
                            as={SubtractionFileSelector}
                            name="uploadId"
                            onClick={id => setFieldValue("uploadId", id)}
                            error={touched.uploadId && errors.uploadId}
                        />

                        <SaveButton />
                    </Form>
                )}
            </Formik>
        </React.Fragment>
    );
};

const mapStateToProps = state => ({
    files: state.files.fileType === "subtraction" ? filter(state.files.documents, { type: "subtraction" }) : null
});

const mapDispatchToProps = dispatch => ({
    onCreate: ({ uploadId, name, nickname }) => {
        dispatch(createSubtraction(uploadId, name, nickname));
    },

    onListFiles: () => {
        dispatch(findFiles("subtraction"));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(CreateSubtraction);
