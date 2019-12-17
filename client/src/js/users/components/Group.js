import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { Checkbox, ListGroupItem, device } from "../../base";

export const Groups = styled(ListGroupItem)`
    @media (min-width: ${device.tablet}) {
        max-width: 333px;
    }
`;

export class UserGroup extends React.Component {
    static propTypes = {
        id: PropTypes.string.isRequired,
        toggled: PropTypes.bool.isRequired,
        onClick: PropTypes.func.isRequired
    };

    handleClick = () => {
        this.props.onClick(this.props.id);
    };

    render() {
        return (
            <Groups className="text-capitalize" onClick={this.handleClick}>
                {this.props.id}
                <Checkbox checked={this.props.toggled} pullRight />
            </Groups>
        );
    }
}
