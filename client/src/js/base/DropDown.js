import React from "react";
import styled from "styled-components";

const DropDownContent = styled.div`
    display: ${props => (props.visible ? "flex" : "none")};

    position: absolute;
    flex-direction: column;
    text-decoration: none;
    background-color: white;
    box-shadow: 0px 8px 16px 0px rgba(0, 0, 0, 0.2);
    top: 45px;
    right: 15px;
`;

const DropDownMenu = styled.div`
    height: 100%;
    padding: 0 15px;
    display: flex;
    justify-content: center;
    align-items: center;
    color: white;
    background-color: ${props => (props.visible ? "rgb(50, 112, 111)" : "none")};

    a {
        text-decoration: none;
        color: black;
    }

    & > a {
        color: white;
        text-decoration: none;

        &: hover {
            color: #245251;
        }
    }
`;

export const DropDownItem = styled.div`
    padding: 10px 15px;
    color: black;
    min-width: 160px;

    &:hover {
        background-color: #f5f5f5;
    }
`;

const getInitialState = () => ({
    visible: false
});

export class DropDown extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState();
    }

    handleClick = () => {
        this.setState({ visible: !this.state.visible });
    };

    render() {
        return (
            <DropDownMenu visible={this.state.visible}>
                <a onClick={this.handleClick} href="#">
                    {this.props.menuName}
                </a>
                <DropDownContent visible={this.state.visible}>{this.props.children}</DropDownContent>
            </DropDownMenu>
        );
    }
}
