import { noop } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { BoxGroupHeader, BoxGroupSection, Button, Input, InputGroup, InputLabel, PasswordInput } from "../base";
import { createFirstUser } from "../users/actions";
import { WallContainer, WallDialog } from "./Container";

const FirstUserDialog = styled(WallDialog)`
    align-items: stretch;
    background-color: ${props => props.theme.color.white};
    border-radius: ${props => props.theme.borderRadius.sm};
    box-shadow: ${props => props.theme.boxShadow.lg};
    display: flex;
    flex-direction: column;
    margin-bottom: 260px;
    max-width: 620px;
    width: 60%;

    button {
        margin-top: 15px;
        float: right;
    }
`;

const FirstUserDialogHeader = styled(BoxGroupHeader)`
    h2 {
        margin: 5px 0 3px;
    }
`;

const FirstUserDialogBody = styled(BoxGroupSection)`
    padding-top: 20px;
`;

export class FirstUser extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            username: "",
            password: ""
        };
    }

    handleChange = e => {
        const { name, value } = e.target;
        this.setState({
            [name]: value
        });
    };

    handleSubmit = e => {
        e.preventDefault();
        this.props.onSubmit(this.state.username, this.state.password);
    };

    render() {
        const { username, password } = this.state;
        return (
            <WallContainer>
                <FirstUserDialog>
                    <FirstUserDialogHeader>
                        <h2>Setup User</h2>
                        <p>Create an initial administrative user to start using Virtool.</p>
                    </FirstUserDialogHeader>
                    <FirstUserDialogBody>
                        <form onSubmit={this.handleSubmit}>
                            <InputGroup>
                                <InputLabel>Username</InputLabel>
                                <Input name="username" value={username} onChange={this.handleChange} />
                            </InputGroup>
                            <InputGroup>
                                <InputLabel>Password</InputLabel>
                                <PasswordInput name="password" value={password} onChange={this.handleChange} />
                            </InputGroup>

                            <Button type="submit" icon="user-plus" color="blue">
                                Create User
                            </Button>
                        </form>
                    </FirstUserDialogBody>
                </FirstUserDialog>
            </WallContainer>
        );
    }
}

export const mapDispatchToProps = dispatch => ({
    onSubmit: (username, password) => {
        dispatch(createFirstUser(username, password));
    }
});

export default connect(noop(), mapDispatchToProps)(FirstUser);
