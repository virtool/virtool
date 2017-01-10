/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports AnalysisList
 */

import React from "react";
import FlipMove from "react-flip-move"
import { sortBy } from "lodash";
import { Alert } from "react-bootstrap";
import { ListGroupItem, Icon, getFlipMoveProps } from "virtool/js/components/Base";

import AnalysisAdder from "./Adder";
import AnalysisItem from "./Item";

const getInitialState = () => ({
    name: "",
    algorithm: "pathoscope_bowtie",
    // True when an analysis request has been sent to the server, but the transaction has not returned.
    pending: false
});

/**
 * A component that lists the analyses associated with a sample and contains a form to add new analyses.
 *
 * @class
 */
export default class AnalysisList extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        sampleId: React.PropTypes.string.isRequired,
        analyses: React.PropTypes.arrayOf(React.PropTypes.object),
        canModify: React.PropTypes.bool,
        setProgress: React.PropTypes.func,
        selectAnalysis: React.PropTypes.func
    };

    handleChange = (event) => {
        let data = {};
        data[event.target.name] = event.target.value;
        this.setState(data);
    };

    /**
     * Handle submission of the new analysis form. Sends a request to the server.
     *
     * @param event {object} - the form submit event.
     * @func
     */
    handleSubmit = (event) => {
        event.preventDefault();

        this.props.setProgress(true);

        this.setState({pending: true}, () => {
            dispatcher.db.samples.request("analyze", {
                samples: [this.props.sampleId],
                discovery: false,
                algorithm: this.state.algorithm,
                name: this.state.name || null
            })
                .success(() => this.onComplete())
                .failure(() => this.onComplete());
        });
    };

    onComplete = () => {
        this.props.setProgress(false);
        this.setState(getInitialState());
    };

    render () {

        let adder;

        if (this.props.canModify) {
            if (dispatcher.db.indexes.count({ready: true}) === 0) {
                adder = (
                    <Alert bsStyle="warning">
                        <Icon name="info"/> A virus index must be built before analyses can be run.
                    </Alert>
                );

            } else {
                adder = (
                    <AnalysisAdder
                        sampleId={this.props.sampleId}
                        setProgress={this.props.setProgress}
                    />
                );
            }
        }

        // The content that will be shown below the "New Analysis" form.
        let listContent;

        // Show a list of analyses if there are any.
        if (this.props.analyses) {

            // Sort by timestamp so the newest analyses are at the top.
            const sorted = sortBy(this.props.analyses, "timestamp").reverse();

            // The components that detail individual analyses.
            listContent = sorted.map((document) =>
                <AnalysisItem
                    key={document._id}
                    {...document}
                    canModify={this.props.canModify}
                    setProgress={this.props.setProgress}
                    selectAnalysis={this.props.selectAnalysis}
                />
            );
        }

        // If no analyses are associated with the sample, show a panel saying so.
        else {
            listContent = (
                <ListGroupItem className="text-center">
                    <Icon name="info"/> No analyses found
                </ListGroupItem>
            );
        }

        return (
            <div>
                {adder}
                <FlipMove {...getFlipMoveProps({typeName: "ul"})}>
                    {listContent}
                </FlipMove>
            </div>
        );
    }
}
