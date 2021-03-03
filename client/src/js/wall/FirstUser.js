import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Formik, Form, Field, ErrorMessage } from "formik";
import {
    BoxGroupHeader,
    BoxGroupSection,
    Button,
    Input,
    InputGroup,
    InputLabel,
    InputError,
    PasswordInput
} from "../base";
import { createFirstUser } from "../users/actions";
import { WallContainer, WallDialog, WallDialogFooter } from "./Container";

export const FirstUser = ({ onSubmit, errors, state, genericError }) => {
    const initialValues = {
        username: "",
        password: ""
    };

    const passwordErrors = get(errors, "password", [""]);
    const usernameErrors = get(errors, "user_id", [""]);

    const handleSubmit = values => {
        onSubmit(values.username, values.password);
        console.log("state", state);
        console.log("genericError", genericError);
        console.log("usernameErrors", usernameErrors);
        console.log("passwordErrors", passwordErrors);
        console.log("errors", errors);
    };

    return (
        <WallContainer>
            <WallDialog size="lg">
                <BoxGroupHeader>
                    <h2>Setup User</h2>
                    <p>Create an initial administrative user to start using Virtool.</p>
                </BoxGroupHeader>
                <Formik initialValues={initialValues} onSubmit={handleSubmit}>
                    <Form>
                        <BoxGroupSection>
                            <InputGroup>
                                <InputLabel>Username</InputLabel>
                                <Field type="text" name="username" as={Input} />
                                <InputError>{usernameErrors[0]}</InputError>
                            </InputGroup>
                            <InputGroup>
                                <InputLabel>Password</InputLabel>
                                <Field name="password" as={PasswordInput} />
                                <InputError>{passwordErrors[0]}</InputError>
                            </InputGroup>
                        </BoxGroupSection>
                        <WallDialogFooter>
                            <Button type="submit" icon="user-plus" color="blue">
                                Create User
                            </Button>
                            <InputError>{genericError}</InputError>
                        </WallDialogFooter>
                    </Form>
                </Formik>
            </WallDialog>
        </WallContainer>
    );
};

export const mapDispatchToProps = dispatch => ({
    onSubmit: (username, password) => {
        dispatch(createFirstUser(username, password));
    }
});

export const mapStateToProps = state => ({
    genericError: get(state, "errors.CREATE_FIRST_USER_ERROR.message", ""),
    // usernameError: get(state, "errors.CREATE_FIRST_USER_ERROR.errors.user_id", ""),
    // passwordError: get(state, "errors.CREATE_FIRST_USER_ERROR.errors.password", ""),
    errors: get(state, "errors.CREATE_FIRST_USER_ERROR.errors", ""),
    state: get(state, "errors.CREATE_FIRST_USER_ERROR", "")
});

export default connect(mapStateToProps, mapDispatchToProps)(FirstUser);
