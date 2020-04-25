import PropTypes from "prop-types";
import React from "react";
import { Button } from "./Button";
import { Dropdown, DropdownMenu, useDropdown } from "./Dropdown";

export const DropdownButton = ({ children, title }) => {
    const [visible, toggle, hide] = useDropdown([null]);

    return (
        <Dropdown top={34}>
            <Button onBlur={hide} onClick={toggle}>
                {title}
            </Button>

            <DropdownMenu top={34} right={0} visible={visible}>
                {children}
            </DropdownMenu>
        </Dropdown>
    );
};

DropdownButton.propTypes = {
    children: PropTypes.node,
    title: PropTypes.node
};
