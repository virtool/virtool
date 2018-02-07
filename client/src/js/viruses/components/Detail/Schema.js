import React from "react";
import { DragDropContext } from "react-dnd";
import HTML5Backend from "react-dnd-html5-backend";
import { map, filter, concat } from "lodash-es";
import Segment from "./Segment";
import AddSegment from "./AddSegment";
import { Icon, Button } from "../../../base";

class Schema extends React.Component {

    constructor (props) {
        super(props);

        // FIXME: simple tester data array, change to handle redux data instead
        this.state = {
            segArray: [
                { id: 1, name: "Seg A", type: "ssDNA" },
                { id: 2, name: "Seg B", type: "dsDNA" },
                { id: 3, name: "Seg C", type: "ssRNA+" },
                { id: 4, name: "Seg D", type: "ssRNA-" },
                { id: 5, name: "Seg E", type: "dsRNA" },
                { id: 6, name: "Seg F", type: "ssRNA" }
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
                key={segment.id}
                segName={segment.name}
                segType={segment.type}
                index={index} id={segment.id}
                moveSeg={this.moveSeg}
                onClick={this.handleRemove}
            />
        );

        return (
            <div>
                <div>
                    <AddSegment show={this.state.show} onHide={this.handleClose} onSubmit={this.handleSubmit} newSeg={this.state.newEntry} total={this.state.length} />
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

export default DragDropContext(HTML5Backend)(Schema);
