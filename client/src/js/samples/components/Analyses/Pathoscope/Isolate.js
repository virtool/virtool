import React from "react";
import PropTypes from "prop-types";
import { Flex, FlexItem } from "../../../../base";
import { map, sortBy } from "lodash-es";

import Coverage from "./Coverage";
import { toScientificNotation } from "../../../../utils";

export default class PathoscopeIsolate extends React.Component {

    static propTypes = {
        otuId: PropTypes.string,
        name: PropTypes.string,
        pi: PropTypes.number,
        best: PropTypes.number,
        coverage: PropTypes.number,
        maxDepth: PropTypes.number,
        reads: PropTypes.number,
        sequences: PropTypes.arrayOf(PropTypes.object),
        setScroll: PropTypes.func,
        showReads: PropTypes.bool
    };

    componentDidMount () {
        this.chartNode.addEventListener("scroll", this.handleScroll);
    }

    componentWillUnmount () {
        this.chartNode.removeEventListener("scroll", this.handleScroll);
    }

    scrollTo = (scrollLeft) => {
        this.chartNode.scrollLeft = scrollLeft;
    };

    handleScroll = (e) => {
        this.props.setScroll(this.props.otuId, e.target.scrollLeft);
    };

    render () {

        const chartContainerStyle = {
            overflowX: "scroll",
            marginTop: "5px",
            boxShadow: "inset 0px 0px 3px 1px #dddddd"
        };

        const chartRibbonStyle = {
            whiteSpace: "nowrap"
        };

        const hitComponents = map(sortBy(this.props.sequences, hit => hit.length), (hit, i) =>
            <Coverage
                key={i}
                data={hit.align}
                length={hit.length}
                id={hit.id}
                definition={hit.definition}
                yMax={this.props.maxDepth}
                showYAxis={i === 0}
                isolateComponent={this}
            />
        );

        const piValue = this.props.showReads ? this.props.reads : toScientificNotation(this.props.pi);

        return (
            <div>
                <div className="pathoscope-isolate-header">
                    <Flex>
                        <FlexItem>
                            {this.props.name}
                        </FlexItem>
                        <FlexItem pad={5}>
                            <strong className="small text-success">
                                {piValue}
                            </strong>
                        </FlexItem>
                        <FlexItem pad={5}>
                            <strong className="small text-danger">
                                {toScientificNotation(this.props.best)}
                            </strong>
                        </FlexItem>
                        <FlexItem pad={5}>
                            <strong className="small text-primary">
                                {toScientificNotation(this.props.coverage)}
                            </strong>
                        </FlexItem>
                    </Flex>
                </div>
                <div ref={(node) => this.chartNode = node} style={chartContainerStyle}>
                    <div style={chartRibbonStyle}>
                        {hitComponents}
                    </div>
                </div>
            </div>
        );
    }
}
