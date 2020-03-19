import { noop } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import {
    BoxGroup,
    BoxGroupHeader,
    BoxGroupSection,
    Button,
    Input,
    InputGroup,
    InputLabel,
    PasswordInput
} from "../base";
import { createFirstUser } from "../users/actions";
import { WallContainer } from "./Container";

const FirstUserModal = styled(BoxGroup)`
    align-items: stretch;
    background-color: #fff;
    border-radius: 4px;
    box-shadow: rgba(0, 0, 0, 0.498039) 0 5px 15px 0;
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

const FirstUserModalHeader = styled(BoxGroupHeader)`
    h2 {
        font-size: 16px;
        margin: 5px 0 3px;
    }
`;

const FirstUserModalBody = styled(BoxGroupSection)`
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
                <FirstUserModal>
                    <FirstUserModalHeader>
                        <h2>Setup User</h2>
                        <p>Create an initial administrative user to start using Virtool.</p>
                    </FirstUserModalHeader>
                    <FirstUserModalBody>
                        <form onSubmit={this.handleSubmit}>
                            <InputGroup>
                                <InputLabel>Username</InputLabel>
                                <Input value={username} onChange={this.handleChange} />
                            </InputGroup>
                            <InputGroup>
                                <InputLabel>Password</InputLabel>
                                <PasswordInput value={password} onChange={this.handleChange} />
                            </InputGroup>

                            <Button type="submit" icon="user-plus" bsStyle="primary">
                                Create User
                            </Button>
                        </form>
                    </FirstUserModalBody>
                </FirstUserModal>
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
