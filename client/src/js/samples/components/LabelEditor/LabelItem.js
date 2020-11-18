import React from "react";
import styled from "styled-components";
import { Label, LinkIcon } from "../../../base";

const getInitialState = ({ name, color, description }) => ({
    name: name || "",
    color: color || "",
    description: description || ""
});

export const BigLabel = styled(Label)`
    padding: 5px;
    font-size: ${props => props.theme.fontSize.lg};
    background-color: ${props => props.color};
`;

export const TableIcon = styled(LinkIcon)`
    padding: 0px 8px;
    font-size: ${props => props.theme.fontSize.lg};
`;

export const Description = styled.p`
    padding: 0px 8px;
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

    render() {
        const name = this.state.name;
        const color = this.state.color;
        const description = this.state.description;
        return (
            <tr>
                <td>
                    <BigLabel color={color}>{name}</BigLabel>
                    <Description>{description}</Description>
                    </td>
                <IconColumn>
                    <TableIcon color="orange" to="" name="pencil-alt" tip="Edit" />
                    <TableIcon color="red" to="" name="fas fa-times" tip="Remove" />
                </IconColumn>
            </tr>
        );
    }
}
