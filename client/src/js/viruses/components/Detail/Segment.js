import React from "react";
import PropTypes from "prop-types";
import { Col, Row, Label } from "react-bootstrap";
import { Icon, ListGroupItem } from "../../../base";

export default class Segment extends React.Component {

    handleRemove = (segment) => {
        this.props.onClick({segment, handler: "remove"});
    }

    handleEdit = (segment) => {
        this.props.onClick({segment, handler: "edit"});
    }

    render () {
        const { seg } = this.props;

        return (
            <div >
                <ListGroupItem className="spaced">
                    <Row>
                        <Col md={5} >
                            <strong>{seg.name}</strong>
                        </Col>
                        <Col md={4}>
                            {seg.molecule}
                        </Col>
                        <Col md={2}>
                            <Label bsStyle={seg.required ? "info" : "warning"}>
                                {seg.required ? "required" : "not required"}
                            </Label>
                        </Col>
                        <Col md={1}>
                            <Icon
                                name="remove"
                                bsStyle="danger"
                                style={{fontSize: "17px", padding: "0 5px"}}
                                onClick={() => {this.handleRemove(seg)}}
                                pullRight
                            />
                            <Icon
                                name="pencil"
                                bsStyle="warning"
                                style={{fontSize: "17px"}}
                                onClick={() => this.handleEdit(seg)}
                                pullRight
                            />
                        </Col>
                    </Row>
                </ListGroupItem>
            </div>
        );
    }
}

Segment.propTypes = {
    index: PropTypes.number.isRequired,
    seg: PropTypes.shape({
        name: PropTypes.string,
        molecule: PropTypes.string,
        required: PropTypes.bool
    }).isRequired,
    onClick: PropTypes.func
};
