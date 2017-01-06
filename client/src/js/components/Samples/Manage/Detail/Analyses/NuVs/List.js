import { assign, flatten, filter, includes, xor } from "lodash";
import React from "react";
import FlipMove from "react-flip-move";

import NuVsEntry from "./Entry";
import NuVsExpansion from "./Expansion";

export default class NuVsList extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            expanded: []
        };
    }

    static propTypes = {
        analysisId: React.PropTypes.string,
        maxSequenceLength: React.PropTypes.number,
        data: React.PropTypes.arrayOf(React.PropTypes.object)
    };

    toggleIn = (sequenceIndex) => {
        this.setState({
            expanded: xor(this.state.expanded, [sequenceIndex])
        });
    };

    collapseAll = () => this.setState({expanded: []});

    render () {

        let data;

        if (this.state.filterORFs) {
            data = this.props.data.map(sequence => assign({}, sequence, {orfs: filter(sequence.orfs, {hasHmm: true})}));
        }

        else if (this.state.filterSequences) {
            data = filter(this.props.data, sequence => sequence.hasSignificantOrf);
        }

        else {
            data = this.props.data;
        }

        let rows = flatten(data.map((item, index) => {

            const expanded = includes(this.state.expanded, item.index);

            let components = [
                <NuVsEntry
                    key={"sequence_" + item.index}
                    {...item}
                    toggleIn={this.toggleIn}
                    in={expanded}
                />
            ];

            if (expanded) {
                components.push(
                    <NuVsExpansion
                        key={index}
                        {...item}
                        analysisId={this.props.analysisId}
                        maxSequenceLength={this.props.maxSequenceLength}
                    />
                );
            }

            return components;

        }));

        return (
            <div>
                <FlipMove
                    typeName="div"
                    className="list-group"
                    enterAnimation="accordianVertical"
                    leaveAnimation={false}
                >
                    {rows}
                </FlipMove>
            </div>
        );
    }

}
