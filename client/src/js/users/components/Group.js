import PropTypes from "prop-types";
import React from "react";
import styled from "styled-components";
import { Checkbox, SelectBoxGroupSection } from "../../base";

const StyledUserGroup = styled(SelectBoxGroupSection)`
    text-transform: capitalize;
    user-select: none;
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
            <StyledUserGroup active={this.props.toggled} onClick={this.handleClick}>
                <Checkbox checked={this.props.toggled} label={this.props.id} />
            </StyledUserGroup>
        );
    }
}
