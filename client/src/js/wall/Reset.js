import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { resetPassword } from "../account/actions";
import { BoxGroupHeader, BoxGroupSection, Button, InputGroup, InputLabel, PasswordInput } from "../base";
import { WallContainer, WallDialog, WallDialogFooter, WallLogo } from "./Container";

export class Reset extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            password: ""
        };
    }

    handleChange = e => {
        this.setState({ password: e.target.value });
    };

    handleSubmit = e => {
        e.preventDefault();
        this.props.onReset(this.state.password, this.props.resetCode);
    };

    render() {
        return (
            <WallContainer>
                <WallLogo height={42} />
                <WallDialog>
                    <BoxGroupHeader>
                        <p>You are required to set a new password before proceeding.</p>
                    </BoxGroupHeader>
                    <form onSubmit={this.handleSubmit}>
                        <BoxGroupSection>
                            <InputGroup>
                                <InputLabel>Password</InputLabel>
                                <PasswordInput
                                    name="password"
                                    value={this.state.password}
                                    onChange={this.handleChange}
                                />
                            </InputGroup>
                        </BoxGroupSection>
                        <WallDialogFooter>
                            <Button type="submit" color="blue">
                                Reset
                            </Button>
                            <span>{this.props.error}</span>
                        </WallDialogFooter>
                    </form>
                </WallDialog>
            </WallContainer>
        );
    }
}

export const mapStateToProps = state => ({
    error: get(state, "errors.RESET_ERROR.message"),
    resetCode: get(state, "app.resetCode")
});

export const mapDispatchToProps = dispatch => ({
    onReset: (password, resetCode) => {
        dispatch(resetPassword(password, resetCode));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(Reset);
