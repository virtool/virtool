import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import {
    BoxGroup,
    BoxGroupHeader,
    BoxGroupSection,
    Checkbox,
    InputContainer,
    InputError,
    InputGroup,
    PasswordInput,
    RelativeTime,
    SaveButton
} from "../../base";
import { editUser } from "../actions";

const PasswordFooter = styled.div`
    align-items: center;
    display: flex;

    button {
        margin-left: auto;
    }
`;

export class Password extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            password: "",
            error: ""
        };
        this.inputRef = React.createRef();
    }

    handleChange = e => {
        const { name, value } = e.target;

        this.setState({
            [name]: value,
            error: ""
        });
    };

    handleSetForceReset = () => {
        this.props.onSetForceReset(this.props.id, !this.props.forceReset);
    };

    handleSubmit = e => {
        e.preventDefault();

        const update = {
            password: "",
            error: ""
        };

        if (this.state.password.length < this.props.minimumPasswordLength) {
            update.error = `Passwords must contain at least ${this.props.minimumPasswordLength} characters`;
        } else {
            this.props.onSubmit(this.props.id, this.state.password);
        }

        this.setState(update);
    };

    render() {
        const { forceReset, lastPasswordChange } = this.props;

        return (
            <BoxGroup>
                <BoxGroupHeader>
                    <h2>Change Password</h2>
                    <p>
                        Last changed <RelativeTime time={lastPasswordChange} em={true} />
                    </p>
                </BoxGroupHeader>

                <BoxGroupSection as="form" onSubmit={this.handleSubmit}>
                    <InputGroup error={this.state.error}>
                        <InputContainer>
                            <PasswordInput name="password" value={this.state.password} onChange={this.handleChange} />
                            <InputError />
                        </InputContainer>
                    </InputGroup>

                    <PasswordFooter>
                        <Checkbox
                            label="Force user to reset password on next login"
                            checked={forceReset}
                            onClick={this.handleSetForceReset}
                        />
                        <SaveButton />
                    </PasswordFooter>
                </BoxGroupSection>
            </BoxGroup>
        );
    }
}

export const mapStateToProps = state => {
    const { force_reset, id, last_password_change } = state.users.detail;
    return {
        id,
        forceReset: force_reset,
        lastPasswordChange: last_password_change,
        minimumPasswordLength: state.settings.data.minimum_password_length
    };
};

export const mapDispatchToProps = dispatch => ({
    onSubmit: (userId, password) => {
        dispatch(editUser(userId, { password }));
    },

    onSetForceReset: (userId, enabled) => {
        dispatch(editUser(userId, { force_reset: enabled }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(Password);
