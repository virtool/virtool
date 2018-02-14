import React from "react";
import { connect } from "react-redux";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { Button } from "react-bootstrap";
import { map } from "lodash-es";
import Segment from "./Segment";
import AddSegment from "./AddSegment";
import EditSegment from "./EditSegment";
import RemoveSegment from "./RemoveSegment";
import { editVirus } from "../../actions";
import { NoneFound } from "../../../base";

const getInitialState = (props) => ({
    segArray: props.schema ? props.schema : [],
    showAdd: false,
    showRemove: false,
    showEdit: false,
    selected: {}
});

const reorder = (list, startIndex, endIndex) => {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);

    return result;
};

const getItemStyle = (isDragging, draggableStyle) => ({
    userSelect: "none",
    margin: "0 0 10px 0",
    ...draggableStyle
});

class Schema extends React.Component {

    constructor (props) {
        super(props);

        this.state = getInitialState(this.props);
    }

    onDragEnd = (result) => {
        if (!result.destination) {
            return;
        }

        const newArray = reorder(
            this.state.segArray,
            result.source.index,
            result.destination.index
        );

        this.setState({segArray: newArray});

        this.props.onSave(
            this.props.virusId,
            this.props.detail.name,
            this.props.detail.abbreviation,
            newArray
        );
    }

    handleAddNew = () => {
        this.setState({showAdd: true});
    }

    handleSubmit = (newArray) => {

        this.setState({
            segArray: newArray,
            showAdd: false,
            showRemove: false,
            showEdit: false
        });

        this.props.onSave(
            this.props.virusId,
            this.props.detail.name,
            this.props.detail.abbreviation,
            newArray
        );
    }

    handleClose = () => {
        this.setState({
            showAdd: false,
            showRemove: false,
            showEdit: false
        });
    }

    handleSegment = (entry) => {
        if (entry.handler === "remove") {
            this.setState({showRemove: true, selected: entry.segment});
        }
        if (entry.handler === "edit") {
            this.setState({showEdit: true, selected: entry.segment});
        }
    }

    render () {
        const { segArray } = this.state;

        let segments;

        if (segArray.length) {
            segments = map(segArray, (segment, index) =>
                <Draggable key={segment.name} draggableId={segment.name} index={index}>
                    {(provided, snapshot) => (
                        <div>
                            <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={getItemStyle(
                                    snapshot.isDragging,
                                    provided.draggableProps.style
                                )}
                            >
                                <Segment
                                    seg={segment}
                                    index={index}
                                    onClick={this.handleSegment}
                                />
                            </div>
                            {provided.placeholder}
                        </div>
                    )}
                </Draggable>
            );
        } else {
            segments = <NoneFound noun="segments" noListGroup />;
        }

        return (
            <div>
                <Button bsStyle="primary" bsSize="large" block onClick={this.handleAddNew}>
                    Add a new segment
                </Button>
                <br />

                <DragDropContext onDragEnd={this.onDragEnd}>
                    <Droppable droppableId="droppable">
                        {(provided) => (
                            <div ref={provided.innerRef}>
                                {segments}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>

                <AddSegment
                    show={this.state.showAdd}
                    onHide={this.handleClose}
                    onSubmit={this.handleSubmit}
                />
                <EditSegment
                    show={this.state.showEdit}
                    onHide={this.handleClose}
                    onSubmit={this.handleSubmit}
                    curSeg={this.state.selected}
                />
                <RemoveSegment
                    show={this.state.showRemove}
                    onHide={this.handleClose}
                    onSubmit={this.handleSubmit}
                    curSeg={this.state.selected}
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    schema: state.viruses.detail.schema,
    detail: state.viruses.detail,
    virusId: state.viruses.detail.id
});

const mapDispatchToProps = (dispatch) => ({

    onSave: (virusId, name, abbreviation, schema) => {
        dispatch(editVirus(virusId, name, abbreviation, schema));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(Schema);
