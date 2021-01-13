import React from "react";
import styled from "styled-components";
import { Label, Icon } from "../../../base";

const getInitialState = ({ name, color, description, id }) => ({
    name: name || "",
    color: color || "",
    description: description || "",
    id: id || ""
});

const getContrastColor = props => {
    const red = parseInt(props.color.substr(1, 2), 16);
    const green = parseInt(props.color.substr(3, 2), 16);
    const blue = parseInt(props.color.substr(5, 2), 16);
    const yiq = (red * 299 + green * 587 + blue * 114) / 1000;
    return yiq >= 128 ? "black" : "white";
};

const LabelItemExample = styled(Label)`
    font-size: ${props => props.theme.fontSize.lg};
    background-color: ${props => props.color};
    color: ${getContrastColor};
`;

const LabelRow = styled.div`
    margin: 5px 8px;
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    justify-content: flex-start;
`;

const IconFlex = styled.div`
    align-self: flex-end;
    margin-left: auto;
`;
const LabelIcon = styled(Icon)`
    margin: 0 10px;
    font-size: 20px;
`;

const Description = styled.p`
    margin: 5px 8px;
`;

export class LabelItem extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(this.props);
    }

    handleRemove = (id, name) => {
        this.props.removeLabel(id, name);
    };

    handleEdit = (id, name, color, description) => {
        this.props.editLabel(id, name, color, description);
    };

    render() {
        const { name, color, description, id } = this.state;
        return (
            <LabelRow>
                <LabelItemExample color={color}>{name}</LabelItemExample>
                <Description>{description}</Description>
                <IconFlex>
                    <LabelIcon
                        color="orange"
                        onClick={() => this.handleEdit(id, name, description, color)}
                        name="pencil-alt"
                        tip="Edit"
                    />
                    <LabelIcon
                        color="red"
                        onClick={() => this.handleRemove(id, name)}
                        name="fas fa-times"
                        tip="Remove"
                    />
                </IconFlex>
            </LabelRow>
        );
    }
}
