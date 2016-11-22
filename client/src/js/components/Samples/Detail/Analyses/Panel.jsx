/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports AnalysisPanel
 */

var _ = require('lodash');
var React = require('react');
var Panel = require('react-bootstrap/lib/Panel');
var AnalysisReport = require('./Report.jsx');
var Listing = require('./Listing.jsx');

/**
 * The panel that is shown when the analysis tab is selected in the sample detail modal. Allows detailed viewing of
 * all analyses associated with a sample and for starting new analyses.
 *
 * @class
 */
var AnalysisPanel = React.createClass({

    propTypes: {
        canModify: React.PropTypes.bool
    },

    getInitialState: function () {
        return {
            activeAnalysisId: null
        };
    },

    /**
     * Shows a detailed view of the analysis identified by the passed analysisId.
     *
     * @param analysisId {string} - the id of the analysis document to open detail for.
     * @func
     */
    selectAnalysis: function (analysisId) {
        this.setState({activeAnalysisId: analysisId});
    },

    /**
     * Shows the AnalysisList component if analysis details are being shown.
     *
     * @func
     */
    showListing: function () {
        this.setState({activeAnalysisId: null});
    },

    render: function () {

        var content;

        if (!this.state.activeAnalysisId) {
            // Show the analysis listing if no activeAnalysisId is defined.
            content = (
                <Listing
                    {...this.props}
                    selectAnalysis={this.selectAnalysis}
                />
            );
        }

        else {
            // Get the analysis document that corresponds to the activeAnalysisId.
            var analysisEntry = _.find(this.props.data.analyses, {_id: this.state.activeAnalysisId});

            content = (
                <AnalysisReport
                    readCount={this.props.data.quality.count}
                    maxReadLength={this.props.data.quality.length[1]}
                    onBack={this.showListing}
                    {...analysisEntry}
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