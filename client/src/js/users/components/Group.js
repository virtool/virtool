import React from "react";
import styled from "styled-components";
import PropTypes from "prop-types";

import { BoxGroupSection, Checkbox } from "../../base";

const StyledUserGroup = styled(BoxGroupSection)`
    align-items: center;
    display: flex;
    justify-content: space-between;
    text-transform: capitalize;
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
            <StyledUserGroup onClick={this.handleClick}>
                <span>{this.props.id}</span>
                <Checkbox checked={this.props.toggled} />
            </StyledUserGroup>
        );
    }
}
