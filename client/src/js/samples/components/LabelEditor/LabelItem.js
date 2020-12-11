import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Label, Icon } from "../../../base";

const getInitialState = ({ name, color, description, id }) => ({
    name: name || "",
    color: color || "",
    description: description || "",
    id: id || ""
});

export const getContrastColor = props => {
    const red = parseInt(props.color.substr(1, 2), 16);
    const green = parseInt(props.color.substr(3, 2), 16);
    const blue = parseInt(props.color.substr(5, 2), 16);
    const yiq = (red * 299 + green * 587 + blue * 114) / 1000;
    return yiq >= 128 ? "black" : "white";
};

export const StyledLabel = styled(Label)`
    padding: 5px;
    font-size: ${props => props.theme.fontSize.lg};
    background-color: ${props => props.color};
    color: ${getContrastColor};
`;

export const StyledIcon = styled(Icon)`
    padding: 0px 8px;
    font-size: 20px;
`;

export const Description = styled.p`
    padding: 0px 8px;
    margin: 0px;
    display: inline-block;
`;
export const IconColumn = styled.td`
    text-align: right;
    min-width: 50px;
    max-width: 75px;
`;

export class LabelItem extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(this.props);
    }

    onRemove = (id, name) => {
        this.props.removeLabel(id, name);
    };

    onEdit = (id, name, color, description) => {
        this.props.editLabel(id, name, color, description);
    };

    render() {
        const name = this.state.name;
        const color = this.state.color;
        const description = this.state.description;
        const id = this.state.id;
        return (
            <tr>
                <td>
                    <StyledLabel color={color}>{name}</StyledLabel>
                    <Description>{description}</Description>
                </td>
                <IconColumn>
                    <StyledIcon
                        color="orange"
                        onClick={() => this.onEdit(id, name, description, color)}
                        name="pencil-alt"
                        tip="Edit"
                    />
                    <StyledIcon color="red" onClick={() => this.onRemove(id, name)} name="fas fa-times" tip="Remove" />
                </IconColumn>
            </tr>
        );
    }
}
const mapStateToProps = state => ({
    name: sate.name,
    color: state.color,
    description: state.description
});

export default connect(mapStateToProps)(LabelItem);
