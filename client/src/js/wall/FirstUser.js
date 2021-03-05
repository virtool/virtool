import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Formik, Form, Field } from "formik";
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

const initialValues = {
    username: "",
    password: ""
};

export const FirstUser = ({ onSubmit, errors }) => {
    const handleSubmit = values => {
        onSubmit(values.username, values.password);
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
                                {errors.usernameErrors.map(error => (
                                    <InputError key={error}>{error}</InputError>
                                ))}
                            </InputGroup>
                            <InputGroup>
                                <InputLabel>Password</InputLabel>
                                <Field name="password" as={PasswordInput} />
                                {errors.passwordErrors.map(error => (
                                    <InputError key={error}>{error}</InputError>
                                ))}
                            </InputGroup>
                        </BoxGroupSection>
                        <WallDialogFooter>
                            <Button type="submit" icon="user-plus" color="blue">
                                Create User
                            </Button>
                            <InputError>{errors.generalError}</InputError>
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
    errors: {
        generalError: get(state, "errors.CREATE_FIRST_USER_ERROR.message", ""),
        usernameErrors: get(state, "errors.CREATE_FIRST_USER_ERROR.errors.user_id", [""]),
        passwordErrors: get(state, "errors.CREATE_FIRST_USER_ERROR.errors.password", [""])
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(FirstUser);
