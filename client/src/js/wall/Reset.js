import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { resetPassword } from "../account/actions";
import { BoxGroup, BoxGroupHeader, BoxGroupSection, Button, Input } from "../base";
import { WallContainer } from "./Container";
import { WallModalFooter } from "./Footer";
import { WallLogo } from "./Logo";

const ResetModal = styled(BoxGroup)`
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
                <ResetModal>
                    <BoxGroupHeader>
                        <p>You are required to set a new password before proceeding.</p>
                    </BoxGroupHeader>
                    <BoxGroupSection>
                        <form onSubmit={this.handleSubmit}>
                            <Input
                                type="password"
                                label="Password"
                                name="password"
                                value={this.state.password}
                                onChange={this.handleChange}
                            />
                            <WallModalFooter>
                                <span>{this.props.error}</span>
                                <Button type="submit" bsStyle="primary">
                                    Reset
                                </Button>
                            </WallModalFooter>
                        </form>
                    </BoxGroupSection>
                </ResetModal>
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

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(Reset);
