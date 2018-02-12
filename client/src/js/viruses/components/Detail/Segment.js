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

    handleRemove = (name) => {
        console.log(`handle segment remove of ${name}`);
        this.props.onClick({name: name, type: "remove"});
    }

    handleEdit = (name) => {
        console.log(`handle segment edit of ${name}`);
        this.props.onClick({name: name, type: "edit"});
    }

    render () {
        const { segName, segType, isDragging, connectDragSource, connectDropTarget } = this.props;

        return connectDragSource(
            connectDropTarget(
                <div style={{opacity: isDragging ? 0 : 1}}>
                    <ListGroupItem className="spaced">
                        <Row>
                            <Col md={10}>
                                <strong>{segName}</strong>
                            </Col>
                            <Col md={1}>
                                {segType}
                            </Col>
                            <Col md={1}>
                                <Icon
                                    name="remove"
                                    bsStyle="danger"
                                    style={{fontSize: "17px"}}
                                    onClick={() => {this.handleRemove(segName)}}
                                    pullRight
                                />
                                <Icon
                                    name="pencil"
                                    bsStyle="warning"
                                    style={{fontSize: "17px"}}
                                    onClick={() => this.handleEdit(segName)}
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
    isDragging: PropTypes.bool.isRequired,
    segName: PropTypes.string.isRequired,
    segType: PropTypes.string.isRequired,
    segReq: PropTypes.bool.isRequired,
    moveSeg: PropTypes.func.isRequired,
    onClick: PropTypes.func
};

export default flow(
    DragSource(ItemTypes.SEGMENT, segSource, collect),
    DropTarget(ItemTypes.SEGMENT, segTarget, combine)
)(Segment);
