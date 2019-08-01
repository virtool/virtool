import { get } from "lodash-es";
import React from "react";
import styled from "styled-components";
import { connect } from "react-redux";
import { login } from "../account/actions";
import { Box, Button, Checkbox, Input } from "../base";
import { clearError } from "../errors/actions";
import { WallContainer } from "./Container";
import { WallLogo } from "./Logo";

const LoginFooter = styled.div`
    align-items: center;
    display: flex;
    justify-content: space-between;
    margin-top: 15px;

    & > span {
        color: ${props => props.theme.color.red};
        font-size: ${props => props.theme.fontSize.xs};
    }
`;

const LoginModal = styled(Box)`
    align-items: stretch;
    background-color: #fff;
    border: none;
    border-radius: 4px;
    box-shadow: rgba(0, 0, 0, 0.498039) 0 5px 15px 0;
    display: flex;
    margin-bottom: 260px;
    flex-direction: column;
    width: 300px;
`;

export class Login extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            username: "",
            password: "",
            remember: false
        };
    }

    handleChange = e => {
        const { name, value } = e.target;
        this.setState({ [name]: value });

        if (this.props.error) {
            this.props.onChange();
        }
    };

    handleSubmit = e => {
        e.preventDefault();
        const { username, password, remember } = this.state;
        this.props.onLogin(username, password, remember);
    };

    handleRemember = () => {
        this.setState({
            remember: !this.state.remember
        });
    };

    render() {
        return (
            <WallContainer>
                <WallLogo height={42} />
                <LoginModal>
                    <form onSubmit={this.handleSubmit}>
                        <Input
                            type="text"
                            label="Username"
                            name="username"
                            value={this.state.username}
                            onChange={this.handleChange}
                            autofocus
                        />
                        <Input
                            type="password"
                            label="Password"
                            name="password"
                            value={this.state.password}
                            onChange={this.handleChange}
                        />
                        <Checkbox checked={this.state.remember} onClick={this.handleRemember} label="Remember Me" />

                        <LoginFooter>
                            <span>{this.props.error}</span>
                            <Button type="submit" bsStyle="primary">
                                Login
                            </Button>
                        </LoginFooter>
                    </form>
                </LoginModal>
            </WallContainer>
        );
    }
}

export const mapStateToProps = state => ({
    error: get(state, "errors.LOGIN_ERROR.message")
});

export const mapDispatchToProps = dispatch => ({
    onChange: () => {
        dispatch(clearError("LOGIN_ERROR"));
    },
    onLogin: (username, password, remember, key) => {
        dispatch(login(username, password, remember, key));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(Login);
