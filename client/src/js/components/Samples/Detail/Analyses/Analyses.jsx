"use strict";

var _ = require("lodash");
var React = require("react");
var Panel = require("react-bootstrap/lib/Panel");
var AnalysisReport = require("./Report.jsx");
var AnalysesList = require("./List.jsx");

var AnalysisPanel = React.createClass({

    propTypes: {
        canModify: React.PropTypes.bool
    },

    getInitialState: function () {
        return {
            activeAnalysisId: null
        };
    },

    selectAnalysis: function (analysisId) {
        this.setState({activeAnalysisId: analysisId});
    },

    showListing: function () {
        this.setState({activeAnalysisId: null});
    },

    render: function () {

        var content;

        if (!this.state.activeAnalysisId) {
            // Show the analysis listing if no activeAnalysisId is defined.
            content = (
                <AnalysesList
                    {...this.props}
                    selectAnalysis={this.selectAnalysis}
                />
            );
        }

        else {
            // Get the analysis document that corresponds to the activeAnalysisId.
            var analysisEntry = _.find(this.props.analyses, {_id: this.state.activeAnalysisId});

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
});

module.exports = AnalysisPanel;