import PropTypes from "prop-types";
import React from "react";
import styled from "styled-components";
import { Dropdown, DropdownMenu, useDropdown } from "./Dropdown";
import { Icon } from "./Icon";

const StyledDropdownIcon = styled(Dropdown)`
    > a {
        font-size: 20px;
        opacity: 0.7;
        text-decoration: none;

        &:focus,
        &:hover {
            opacity: 1;
        }
    }
`;

export const DropdownIcon = ({ children, name, tip, tipPlacement }) => {
    const [visible, toggle, hide] = useDropdown([null]);

    return (
        <StyledDropdownIcon>
            <a href="#" onClick={toggle} onBlur={hide}>
                <Icon name={name} tip={tip} tipPlacement={tipPlacement} />
            </a>
            <DropdownMenu right={0} top={30} visible={visible}>
                {children}
            </DropdownMenu>
        </StyledDropdownIcon>
    );
};

DropdownIcon.propTypes = {
    children: PropTypes.node,
    name: PropTypes.string.isRequired,
    tip: PropTypes.string,
    tipPlacement: PropTypes.oneOf(["top", "right", "bottom", "left"])
};
