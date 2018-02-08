import React from "react";
import { connect } from "react-redux";
import { DragDropContext } from "react-dnd";
import HTML5Backend from "react-dnd-html5-backend";
import { map, filter, concat } from "lodash-es";
import Segment from "./Segment";
import AddSegment from "./AddSegment";
//import EditSegment from "./EditSegment";
//import RemoveSegment from "./RemoveSegment";
//import { showAddSegment, showEditSegment, showRemoveSegment } from "../../actions";
import { Icon, Button } from "../../../base";

class Schema extends React.Component {

    constructor (props) {
        super(props);

        // FIXME: simple tester data array, change to handle redux data instead
        this.state = {
            segArray: [
                { name: "Seg A", molecule: "ssDNA", required: false },
                { name: "Seg B", molecule: "dsDNA", required: false },
                { name: "Seg C", molecule: "ssRNA+", required: false },
                { name: "Seg D", molecule: "ssRNA-", required: false },
                { name: "Seg E", molecule: "dsRNA", required: false },
                { name: "Seg F", molecule: "ssRNA", required: false }
            ],
            show: false,
            length: 6
        };

        this.moveSeg = this.moveSeg.bind(this);
    }

    moveSeg (dragIndex, hoverIndex) {
        const { segArray } = this.state;
        const dragSeg = segArray[dragIndex];

        const newArray = segArray.slice();
        newArray.splice(dragIndex, 1);
        newArray.splice(hoverIndex, 0, dragSeg);

        this.setState({segArray: newArray});
    }

    // FIXME: simple deletion for internal tester array
    handleRemove = (segment) => {
        console.log(`redux delete ${segment}`);

        const { segArray } = this.state;

        let newArray = segArray.slice();
        newArray = filter(newArray, function (f) { return f.name !== segment});

        this.setState({segArray: newArray});
    } 

    handleClick = () => {
        this.setState({show: true});
    }

    // FIXME: simple addition for internal tester array
    handleSubmit = (newSegment) => {
        console.log("redux add new segment entry");

        const { segArray } = this.state;

        let newArray = segArray.slice();
        newArray = concat(newArray, newSegment);

        this.setState({
            segArray: newArray, 
            show: false,
            length: newArray.length
        });
    }

    handleClose = () => {
        this.setState({show: false});
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
                onClick={this.handleRemove}
            />
        );

        return (
            <div>
                <div>
                    <AddSegment show={this.state.show} onHide={this.handleClose} onSubmit={this.handleSubmit} total={this.state.length} />
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
            </div>
        );
    }
}

//export default DragDropContext(HTML5Backend)(Schema);

const mapStateToProps = (state) => {
    let sequences = null;
    let activeIsolate = null;

    const activeIsolateId = state.viruses.activeIsolateId;

    if (state.viruses.detail.isolates.length) {
        activeIsolate = find(state.viruses.detail.isolates, {id: activeIsolateId});
        sequences = activeIsolate.sequences;
    }

    return {
        activeIsolateId,
        sequences,
        virusId: state.viruses.detail.id,
        canModify: state.account.permissions.modify_virus,
        editing: state.viruses.editSequence,
        isolateName: formatIsolateName(activeIsolate),
        showAddSequence: state.viruses.showAddSequence,
        showEditSequence: state.viruses.showEditSequence,
        showRemoveSequence: state.viruses.showRemoveSequence
    };
};

const mapDispatchToProps = (dispatch) => ({

    showAddSegment: () => {
        dispatch(showAddSegment());
    },

    showEditSequence: (sequenceId) => {
        dispatch(showEditSegment(sequenceId));
    },

    showRemoveSequence: (sequenceId) => {
        dispatch(showRemoveSegment(sequenceId));
    }

});

const Schemas = DragDropContext(HTML5Backend)(Schema);

export default connect(mapStateToProps, mapDispatchToProps)(Schemas);

