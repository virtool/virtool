import React, { useState } from "react";
import styled from "styled-components";
import { Icon } from "./Icon";

const InputContext = React.createContext("");

const getInputFocusColor = ({ error }) => (error ? "rgba(229, 62, 62, 0.5)" : "rgba(43, 108, 176, 0.5)");

export const InputError = styled.p`
    color: ${props => props.theme.color.red};
    font-size: ${props => props.theme.fontSize.sm};
    margin: 5px 0 -10px;
    min-height: 18px;
    text-align: right;
`;

export const StyledInputGroup = styled.div`
    margin: 0 0 15px;
    min-height: 73px;
`;

export const InputGroup = ({ children, className, error }) => (
    <InputContext.Provider value={error}>
        <StyledInputGroup className={className}>{children}</StyledInputGroup>
    </InputContext.Provider>
);

export const InputLabel = styled.label`
    font-weight: bold;
`;

export class UnstyledInput extends React.Component {
    constructor(props) {
        super(props);
        this.inputRef = React.createRef();
    }

    static contextType = InputContext;

    /**
     * Blurs the <input /> element. Not used internally. It is intended for use by the parent component.
     */
    blur = () => {
        this.inputNode.current.blur();
    };

    /**
     * Focus the <input /> element.
     */
    focus = () => {
        this.inputNode.current.focus();
    };

    render() {
        return (
            <input
                ref={this.inputRef}
                autoFocus={this.props.autoFocus}
                children={this.props.children}
                className={this.props.className}
                max={this.props.max}
                min={this.props.min}
                name={this.props.name}
                placeholder={this.props.placeholder}
                readOnly={this.props.readOnly}
                step={this.props.step}
                type={this.props.type}
                value={this.props.value}
                onBlur={this.props.onBlur}
                onChange={this.props.onChange}
                onFocus={this.props.onFocus}
            />
        );
    }
}

export const Input = styled(UnstyledInput)`
    background-color: ${props => props.theme.color.white};
    border: 1px solid ${props => (props.error ? props.theme.color.red : props.theme.color.greyLight)};
    border-radius: ${props => props.theme.borderRadius.sm};
    box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.075);
    display: block;
    font-size: ${props => props.theme.fontSize.md};
    height: auto;
    outline: none;
    padding: 8px 10px;
    position: relative;
    transition: border-color ease-in-out 150ms, box-shadow ease-in-out 150ms;
    width: 100%;

    :focus {
        border-color: ${props => (props.error ? props.theme.color.red : props.theme.color.blue)};
        box-shadow: 0 0 0 2px ${getInputFocusColor};
    }

    :not(select):read-only {
        background-color: ${props => props.theme.color.greyLightest};
    }
`;

export const Select = props => {
    const { children, ...rest } = props;
    return (
        <Input as="select" {...rest}>
            {children}
        </Input>
    );
};

export const InputIcon = styled(Icon)`
    align-items: center;
    display: flex;
    justify-content: center;
    position: absolute;
    top: 0;
    bottom: 0;
    width: 40px;
`;

export const SearchInput = props => (
    <InputContainer align="left">
        <Input {...props} />
        <InputIcon name="search" />
    </InputContainer>
);

export const PasswordInput = props => {
    const [show, setShow] = useState(false);
    return (
        <InputContainer align="right">
            <Input type={show ? "text" : "password"} {...props} />
            <InputIcon name={show ? "eye-slash" : "eye"} onClick={() => setShow(!show)} />
        </InputContainer>
    );
};

export const InputContainer = styled.div`
    position: relative;

    ${Input} {
        padding-${props => props.align}: 40px;
    }

    ${InputIcon} {
        ${props => props.align}: 0;
    }
`;
