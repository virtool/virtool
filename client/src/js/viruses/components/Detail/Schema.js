import React from "react";
import { connect } from "react-redux";
import { DragDropContext } from "react-dnd";
import HTML5Backend from "react-dnd-html5-backend";
import { map } from "lodash-es";
import Segment from "./Segment";
import AddSegment from "./AddSegment";
import EditSegment from "./EditSegment";
import RemoveSegment from "./RemoveSegment";
import { editVirus } from "../../actions";
import { NoneFound, ListGroupItem, Icon } from "../../../base";

const getInitialState = (props) => ({
    segArray: props.schema ? props.schema : [],
    showAdd: false,
    showRemove: false,
    showEdit: false,
    selected: {}
});

class VirusSchema extends React.Component {

    constructor (props) {
        super(props);

        this.state = getInitialState(this.props);
    }

    moveSeg = (dragIndex, hoverIndex) => {
        const { segArray } = this.state;
        const dragSeg = segArray[dragIndex];

        const newArray = segArray.slice();
        newArray.splice(dragIndex, 1);
        newArray.splice(hoverIndex, 0, dragSeg);

        this.setState({segArray: newArray});

        this.props.onSave(
            this.props.match.params.virusId,
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
            this.props.match.params.virusId,
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
                <Segment
                    key={segment.name}
                    seg={segment}
                    index={index}
                    moveSeg={this.moveSeg}
                    onClick={this.handleSegment}
                />
            );
        } else {
            segments = <NoneFound noun="segments" noListGroup />;
        }

        return (
            <div>
                <ListGroupItem className="spaced" onClick={this.handleAddNew}>
                    Add a new segment
                    <Icon
                        name="new-entry"
                        bsStyle="primary"
                        style={{fontSize: "17px"}}
                        pullRight
                    />
                </ListGroupItem>
                <br />
                {segments}
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
    schema: state.viruses.detail.schema
});

const mapDispatchToProps = (dispatch) => ({

    onSave: (virusId, name, abbreviation, schema) => {
        dispatch(editVirus(virusId, name, abbreviation, schema));
    }

});

const Schema = DragDropContext(HTML5Backend)(VirusSchema);

export default connect(mapStateToProps, mapDispatchToProps)(Schema);
