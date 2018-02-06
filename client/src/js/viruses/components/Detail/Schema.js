import React from "react";
import { DragDropContext } from "react-dnd";
import HTML5Backend from "react-dnd-html5-backend";
import { map } from "lodash-es";
import Segment from "./Segment";
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
            ]
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

    render () {
        const { segArray } = this.state;

        const segments = map(segArray, (segment, index) =>
            <Segment key={segment.id} segName={segment.name} index={index} id={segment.id} moveSeg={this.moveSeg} onClick={this.handleRemove} />
        );

        return (
            <div>
                <div>
                    <Icon
                        name="remove"
                        bsStyle="danger"
                        style={{fontSize: "17px"}}
                        onClick={() => {this.props.onClick(this.props.segName)}}
                        pullRight
                    />
                </div>
                {segments}
            </div>
        );
    }
}

export default DragDropContext(HTML5Backend)(Schema);
