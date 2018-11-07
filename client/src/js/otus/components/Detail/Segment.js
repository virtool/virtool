import React from "react";
import PropTypes from "prop-types";
import { Col, Row, Label } from "react-bootstrap";
import { Icon, ListGroupItem } from "../../../base";

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
            <div>
                <ListGroupItem className="spaced">
                    <Row>
                        <Col md={5}>
                            <strong>{seg.name}</strong>
                        </Col>
                        <Col md={4}>{seg.molecule}</Col>
                        <Col md={2}>
                            <Label bsStyle={seg.required ? "info" : "warning"}>
                                {seg.required ? "required" : "not required"}
                            </Label>
                        </Col>
                        <Col md={1}>{modifyIcons}</Col>
                    </Row>
                </ListGroupItem>
            </div>
        );
    }
}

Segment.propTypes = {
    index: PropTypes.number.isRequired,
    seg: PropTypes.object.isRequired,
    onClick: PropTypes.func,
    canModify: PropTypes.bool
};
