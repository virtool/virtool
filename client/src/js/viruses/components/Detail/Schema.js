import React from "react";
import { DragDropContext } from "react-dnd";
import HTML5Backend from "react-dnd-html5-backend";
import { map } from "lodash-es";
import Segment from "./Segment";
import AddSegment from "./AddSegment";
import { Icon } from "../../../base";

class Schema extends React.Component {

    constructor (props) {
        super(props);

        // FIXME: simple tester data array, change to handle redux data instead
        this.state = {
            segArray: [
                { id: 1, name: "Seg A" },
                { id: 2, name: "Seg B" },
                { id: 3, name: "Seg C" },
                { id: 4, name: "Seg D" },
                { id: 5, name: "Seg E" }
            ],
            show: false
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

    handleRemove = (segment) => {
        console.log(`redux delete ${segment}`);
    } 

    handleClick = () => {
        console.log("redux add new segment entry");
        this.setState({show: true});
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
                index={index} id={segment.id}
                moveSeg={this.moveSeg}
                onClick={this.handleRemove}
            />
        );

        return (
            <div>
                <div>
                    <AddSegment show={this.state.show} onHide={this.handleClose} />
                    <Icon
                        name="plus-square"
                        bsStyle="primary"
                        style={{fontSize: "17px"}}
                        tip="Add new entry"
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
