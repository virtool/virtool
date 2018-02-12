import React from "react";
import PropTypes from "prop-types";
import { Col, Row } from "react-bootstrap";
import { DragSource, DropTarget } from "react-dnd";
import { Icon, ListGroupItem } from "../../../base";
import { ItemTypes } from "./ItemTypes";
import { flow } from "lodash-es";

const segSource = {
    beginDrag (props) {
        return {
            index: props.index
        };
    }
};

const segTarget = {
    drop (props, monitor) {
        const dragIndex = monitor.getItem().index;
        const hoverIndex = props.index;

        props.moveSeg(dragIndex, hoverIndex);
    }
};

function collect (connect, monitor) {
    return {
        connectDragSource: connect.dragSource(),
        isDragging: monitor.isDragging()
    };
}

function combine (connect) {
    return {
        connectDropTarget: connect.dropTarget()
    };
}

class Segment extends React.Component {

    handleRemove = (segment) => {
        this.props.onClick({segment, handler: "remove"});
    }

    handleEdit = (segment) => {
        this.props.onClick({segment, handler: "edit"});
    }

    render () {
        const { seg, isDragging, connectDragSource, connectDropTarget } = this.props;

        return connectDragSource(
            connectDropTarget(
                <div style={{opacity: isDragging ? 0 : 1}}>
                    <ListGroupItem className="spaced">
                        <Row>
                            <Col md={9}>
                                <strong>{seg.name}</strong>
                            </Col>
                            <Col md={1}>
                                {seg.molecule}
                            </Col>
                            <Col md={1}>
                                {seg.required ? "required" : "not required"}
                            </Col>
                            <Col md={1}>
                                <Icon
                                    name="remove"
                                    bsStyle="danger"
                                    style={{fontSize: "17px"}}
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
            )
        );
    }
}

Segment.propTypes = {
    connectDragSource: PropTypes.func.isRequired,
    connectDropTarget: PropTypes.func.isRequired,
    index: PropTypes.number.isRequired,
    seg: PropTypes.shape({
        name: PropTypes.string,
        molecule: PropTypes.string,
        required: PropTypes.bool
    }).isRequired,
    isDragging: PropTypes.bool.isRequired,
    moveSeg: PropTypes.func.isRequired,
    onClick: PropTypes.func
};

export default flow(
    DragSource(ItemTypes.SEGMENT, segSource, collect),
    DropTarget(ItemTypes.SEGMENT, segTarget, combine)
)(Segment);
