var _ = require('lodash');
var React = require('react');
var Alert = require('react-bootstrap/lib/Alert');

var Icon = require('virtool/js/components/Base/Icon.jsx');

var NuVsController = require('./Controller.jsx');

var NuVsViewer = React.createClass({

    render: function () {
        // The length of the longest sequence will be stored here.
        var maxSequenceLength = 0;

        var significantHmms = _.filter(this.props.hmm, function (hmm) {
            return hmm.full_e < 1e-10;
        });

        var data = this.props.sequences.map(function (sequence) {

            if (sequence.sequence.length > maxSequenceLength) {
                maxSequenceLength = sequence.sequence.length;
            }

            var sequenceEntry = _.clone(sequence);

            var minE = 10;

            var sequenceHmms = _.filter(significantHmms, {index: sequence.index});

            sequenceEntry.orfs = _.filter(this.props.orfs, {index: sequence.index}).map(function (orf) {
                // The significant HMM hits associated with this ORF;
                var orfHmms = _.filter(sequenceHmms, {orf_index: orf.orf_index});

                // The lowest e-value for HMMs associated with this ORF.
                var orfMinE = _.reduce(orfHmms, function (min, hmm) {
                    return hmm.full_e < min ? hmm.full_e: min;
                }, 10);

                // Update the sequence minimum HMM e-value if the one for this ORF is lower.
                if (minE > orfMinE) {
                    minE = orfMinE;
                }

                return _.assign({
                    hmms: orfHmms,
                    hasHmm: orfHmms.length > 0,
                    minE: orfMinE
                }, orf);
            });

            _.assign(sequenceEntry, {
                minE: minE,
                hasSignificantOrf: _.some(sequenceEntry.orfs, {hasHmm: true}),
                orfs: _.sortBy(sequenceEntry.orfs, 'pos[0]')
            });

            return sequenceEntry;

        }, this);

        data = _.sortBy(data, 'minE');

        return (
            <NuVsController
                data={data}
                analysisId={this.props._id}
                maxSequenceLength={maxSequenceLength}
            />
        );
    }

});

module.exports = NuVsViewer;