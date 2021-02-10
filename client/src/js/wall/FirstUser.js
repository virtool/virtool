import { noop } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Formik, Form, Field, ErrorMessage } from "formik";
import { BoxGroupHeader, BoxGroupSection, Button, Input, InputGroup, InputLabel, InputError, PasswordInput } from "../base";
import { createFirstUser } from "../users/actions";
import { WallContainer, WallDialog, WallDialogFooter } from "./Container";


export const FirstUser = ({onSubmit}) => {

    const initialValues = {
        username: "",
        password: ""
    };

    const handleSubmit = values => {
        onSubmit(values.username, values.password);
    };

    const validate = values => {
        let errors = {};

        const minimum_password_length = 8;

        if(values.password.length < minimum_password_length)
            errors.password = "password should be at least 8 characters long"
        
        return errors;
    };

    return (
            <WallContainer>
                <WallDialog size="lg">
                    <BoxGroupHeader>
                        <h2>Setup User</h2>
                        <p>Create an initial administrative user to start using Virtool.</p>
                    </BoxGroupHeader>
                    <Formik initialValues={initialValues} validate={validate} onSubmit={handleSubmit}>
                        <Form>
                            <BoxGroupSection>
                                <InputGroup>
                                    <InputLabel>Username</InputLabel>
                                    <Field type="text" name="username" as={Input}/>
                                </InputGroup>
                                <InputGroup>
                                    <InputLabel>Password</InputLabel>
                                    <Field name="password" as={PasswordInput}/>
                                </InputGroup>
                            </BoxGroupSection>
                            <WallDialogFooter>
                                <Button type="submit" icon="user-plus" color="blue">
                                    Create User
                                </Button>
                                <ErrorMessage name="password">
                                    {
                                        errorMessage => { return <InputError>{errorMessage}</InputError> }
                                    }
                                </ErrorMessage>
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

export default connect(noop(), mapDispatchToProps)(FirstUser);
