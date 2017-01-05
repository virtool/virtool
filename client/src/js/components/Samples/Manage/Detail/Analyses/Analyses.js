"use strict";

import React from "react";
import { find } from "lodash";
import { Panel } from "react-bootstrap";

import AnalysisList from "./List";
import AnalysisReport from "./Report";

/**
 * The panel that is shown when the analysis tab is selected in the sample detail modal. Allows detailed viewing of
 * all analyses associated with a sample and for starting new analyses.
 *
 * @class
 */
export default class AnalysisPanel extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            activeAnalysisId: null
        };
    }

    static propTypes = {
        _id: React.PropTypes.string,
        analyses: React.PropTypes.array,
        canModify: React.PropTypes.bool,
        setProgress: React.PropTypes.func,
        quality: React.PropTypes.object
    };

    selectAnalysis = (analysisId) => this.setState({activeAnalysisId: analysisId});

    showListing = () => this.setState({activeAnalysisId: null});

    render () {

        let content;

        if (!this.state.activeAnalysisId) {
            // Show the analysis listing if no activeAnalysisId is defined.
            content = (
                <AnalysisList
                    {...this.props}
                    selectAnalysis={this.selectAnalysis}
                />
            );
        } else {
            // Get the analysis document that corresponds to the activeAnalysisId.
            const analysisEntry = find(this.props.analyses, {_id: this.state.activeAnalysisId});

            content = (
                <AnalysisReport
                    {...analysisEntry}
                    readCount={this.props.quality.count}
                    maxReadLength={this.props.quality.length[1]}
                    onBack={this.showListing}
                />
            );
        }

        return (
            <Panel className="tab-panel">
                {content}
            </Panel>
        );
    }
}
