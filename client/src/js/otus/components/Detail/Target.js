import React from "react";
import styled from "styled-components";
import { BoxGroupSection, Button, Badge } from "../../../base";

const TargetComponents = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-gap: 91px;
`;

const RequiredLength = styled.div`
    display: flex;
    justify-content: space-between;
    margin-left: 10px;
    div {
        color: ${props => props.theme.color.red};
        font-weight: bold;
    }
`;

const AddButton = styled.div`
    display: flex;
    justify-content: center;
    padding-top: 15px;
`;

export class Target extends React.Component {
    render() {
        const lengthSection = this.props.length ? <Badge>{this.props.length}</Badge> : "";

        return (
            <BoxGroupSection>
                <TargetComponents>
                    <span>{this.props.name}</span>
                    <RequiredLength>
                        <div>{this.props.required}</div>
                        {lengthSection}
                    </RequiredLength>
                </TargetComponents>
                <span>{this.props.description}</span>
                <AddButton>
                    <Button onClick={this.props.onClick}>Add</Button>
                </AddButton>
            </BoxGroupSection>
        );
    }
}
