import React from "react";
import styled from "styled-components";
import { Link } from "react-router-dom";

const DropDownContent = styled.div`
    display: ${props => (props.visible ? "flex" : "none")};

    position: absolute;
    flex-direction: column;
    text-decoration: none;
    background-color: white;
    box-shadow: 0 8px 16px 0px rgba(0, 0, 0, 0.2);
    top: 45px;
    right: 15px;
`;

const DropDownMenu = styled.div`
    height: 100%;
    padding: 0;
    display: flex;
    justify-content: center;
    align-items: stretch;
    color: white;
    background-color: ${props => (props.visible ? "rgb(50, 112, 111)" : "none")};

    a {
        text-decoration: none;
        color: black;
    }

    & > a {
        align-items: center;
        display: flex;
        padding: 0 15px;
        color: white;
        text-decoration: none;

        :hover {
            color: #245251;
            text-decoration: none;
        }
    }

    &: focus {
        text-decoration: none;
        color: white;
    }
`;

export const DropDownItem = styled(Link)`
    padding: 10px 15px;
    color: black;
    min-width: 160px;

    &:hover {
        background-color: #f5f5f5;
    }
`;

export class DropDown extends React.Component {
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
