import React from "react";
import styled from "styled-components";
import { BoxGroupSection, Icon } from "../../../base";
import { formatIsolateName } from "../../../utils/utils";

const StyledIsolateButton = styled(BoxGroupSection)`
    align-items: center;
    border: none;
    display: flex;

    & > span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    i.fas {
        margin-left: auto;
    }
`;

export class IsolateButton extends React.Component {
    handleSelectIsolate = () => {
        this.props.onClick(this.props.id);
    };

    render() {
        return (
            <StyledIsolateButton active={this.props.active} onClick={this.handleSelectIsolate}>
                <span>{formatIsolateName(this.props)}</span>
                {this.props.default ? <Icon name="star" /> : null}
            </StyledIsolateButton>
        );
    }
}
