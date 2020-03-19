import PropTypes from "prop-types";
import React from "react";
import styled from "styled-components";
import { Icon, Label, SpacedBox } from "../../../base";

const StyledSegment = styled(SpacedBox)`
    display: grid;
    align-items: center;
    grid-template-columns: 45fr 1fr 10fr;
`;

const RequiredLabel = ({ required }) => {
    if (required) {
        return <Label color="purple">Required</Label>;
    }

    return <Label>Optional</Label>;
};

export default class Segment extends React.Component {
    handleRemove = () => {
        this.props.onClick({ segment: this.props.seg, handler: "remove" });
    };

    handleEdit = () => {
        this.props.onClick({ segment: this.props.seg, handler: "edit" });
    };

    render() {
        const { seg, canModify } = this.props;

        let modifyIcons;

        if (canModify) {
            modifyIcons = (
                <div>
                    <Icon
                        name="trash"
                        bsStyle="danger"
                        tip="Remove Segment"
                        tipPlacement="left"
                        style={{ fontSize: "17px", padding: "0 5px" }}
                        onClick={this.handleRemove}
                        pullRight
                    />
                    <Icon
                        name="pencil-alt"
                        bsStyle="warning"
                        tip="Edit Segment"
                        tipPlacement="left"
                        style={{ fontSize: "17px" }}
                        onClick={this.handleEdit}
                        pullRight
                    />
                </div>
            );
        }

        return (
            <StyledSegment>
                <strong>{seg.name}</strong>

                <RequiredLabel required={seg.required} />
                {modifyIcons}
            </StyledSegment>
        );
    }
}

Segment.propTypes = {
    index: PropTypes.number.isRequired,
    seg: PropTypes.object.isRequired,
    onClick: PropTypes.func,
    canModify: PropTypes.bool
};
