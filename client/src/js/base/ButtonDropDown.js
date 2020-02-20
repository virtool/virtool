import React from "react";
import styled from "styled-components";

export const DropDownItem = styled.div`
    padding: 10px 15px;
    color: black;
    min-width: 160px;
    cursor: pointer;

    &:hover {
        background-color: #f5f5f5;
    }
`;

export const DropDownContent = styled.div`
    display: ${props => (props.visible ? "flex" : "none")};

    position: absolute;
    flex-direction: column;
    text-decoration: none;
    background-color: white;
    box-shadow: 0 8px 16px 0px rgba(0, 0, 0, 0.2);
    top: 295px;
    right: 317px;
    border: 1px solid rgba(173, 173, 173, 173);
`;

const DropDownMenu = styled.div`
    display: flex;
    justify-content: center;

    border: 1px solid #adadad;
    background-color: ${props => (props.visible ? "#e6e6e6" : "white")};
    box-shadow: ${props => (props.visible ? "inset 0 3px 5px rgba(0, 0, 0, 0.125)" : "")};
    & > a {
        align-items: center;
        display: flex;
        padding: 0 15px;
        color: black;
        text-decoration: none;
    }
    &:hover {
        color: rgb(204, 204, 204);
        text-decoration: none;
    }
    &: focus {
        text-decoration: none;
        color: white;
    }
`;

export class ButtonDropDown extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            visible: false
        };
    }

    handleClick = () => {
        this.setState({ visible: !this.state.visible });
    };

    handleBlur = () => {
        setTimeout(() => {
            this.setState({ visible: false });
        }, 100);
    };

    render() {
        return (
            <DropDownMenu visible={this.state.visible}>
                <a onClick={this.handleClick} onBlur={this.handleBlur} href="#">
                    {this.props.menuName}
                </a>

                <DropDownContent visible={this.state.visible}>{this.props.children}</DropDownContent>
            </DropDownMenu>
        );
    }
}
