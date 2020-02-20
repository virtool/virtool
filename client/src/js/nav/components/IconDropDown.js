import React from "react";
import styled from "styled-components";
import { Link } from "react-router-dom";
import { DropDownMenu, DropDownContent } from "../../base";

export const DropDownItem = styled(Link)`
    padding: 10px 15px;
    color: black;
    min-width: 160px;

    &:hover {
        background-color: #f5f5f5;
    }
`;

export class IconDropDown extends React.Component {
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
