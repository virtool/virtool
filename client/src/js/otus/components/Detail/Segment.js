import PropTypes from "prop-types";
import React from "react";
import { Col, Row } from "react-bootstrap";
import { Icon, InfoLabel, Label, SpacedBox } from "../../../base";

const RequiredLabel = ({ required }) => {
    if (required) {
        return <InfoLabel>Required</InfoLabel>;
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
            <SpacedBox>
                <Row>
                    <Col md={5}>
                        <strong>{seg.name}</strong>
                    </Col>
                    <Col md={4}>{seg.molecule}</Col>
                    <Col md={2}>
                        <RequiredLabel required={seg.required} />
                    </Col>
                    <Col md={1}>{modifyIcons}</Col>
                </Row>
            </SpacedBox>
        );
    }
}

Segment.propTypes = {
    index: PropTypes.number.isRequired,
    seg: PropTypes.object.isRequired,
    onClick: PropTypes.func,
    canModify: PropTypes.bool
};
