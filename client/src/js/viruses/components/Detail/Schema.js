import React from "react";
import { connect } from "react-redux";
import { DragDropContext } from "react-dnd";
import HTML5Backend from "react-dnd-html5-backend";
import { map } from "lodash-es";
import Segment from "./Segment";
import AddSegment from "./AddSegment";
//import EditSegment from "./EditSegment";
import RemoveSegment from "./RemoveSegment";
import { editVirus } from "../../actions";
import { Button } from "../../../base";

const getInitialState = (props) => ({
    segArray: props.schema ? props.schema : [],
    showAdd: false,
    showRemove: false,
    showEdit: false,
    length: 0
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
    }

    handleClick = () => {
        this.setState({showAdd: true});
    }

    handleSubmit = (newArray) => {
        const newLength = newArray.length;

        this.setState({
            segArray: newArray,
            showAdd: false,
            showRemove: false,
            showEdit: false,
            length: newLength
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

    render () {
        const { segArray } = this.state;

        const segments = map(segArray, (segment, index) =>
            <Segment
                key={segment.name}
                segName={segment.name}
                segType={segment.molecule}
                segReq={segment.required}
                index={index}
                moveSeg={this.moveSeg}
                onSubmit={this.handleSubmit}
            />
        );

        return (
            <div>
                <div>
                    <Button
                        icon="new-entry"
                        bsStyle="primary"
                        tip="Add new segment"
                        onClick={this.handleClick}
                        pullRight
                    />
                </div>
                <br />
                <br />
                {segments}
                <AddSegment
                    show={this.state.showAdd}
                    onHide={this.handleClose}
                    onSubmit={this.handleSubmit}
                    total={this.state.length}
                    curSegArr={this.state.segArray}
                />
                {/*<EditSegment
                    show={this.state.showEdit}
                    onHide={this.handleClose}
                    onSubmit={this.handleSubmit}
                    currSegArr={this.state.segArray}
                />*/}
                <RemoveSegment
                    show={this.state.showRemove}
                    onHide={this.handleClose}
                    onSubmit={this.handleSubmit}
                    curSegArr={this.state.segArray}
                    curSeg={}
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => {

    return {
        schema: state.viruses.detail.schema,
    };
};

const mapDispatchToProps = (dispatch) => ({

    onSave: (virusId, name, abbreviation, schema) => {
        dispatch(editVirus(virusId, name, abbreviation, schema));
    }

});

const Schema = DragDropContext(HTML5Backend)(VirusSchema);

export default connect(mapStateToProps, mapDispatchToProps)(Schema);

