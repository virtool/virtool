var d3 = require('d3');
var React = require('react');
var ListGroup = require('react-bootstrap/lib/ListGroup');

var Diagram = require('./Diagram.jsx');

var List = React.createClass({

    shouldComponentUpdate: function (nextProps) {
        return (
            !_.isEqual(nextProps.hmms, this.props.hmms) ||
            !_.isEqual(nextProps.orfs, this.props.orfs) ||
            !_.isEqual(nextProps.sequences, this.props.sequences)
        )
    },

    render: function () {// Get a list of all sequence indexes found in the HMMs.
        var indexes = _.uniq(_.map(this.props.hmms, 'index'));

        var maxSequenceLength = 0;

        composites = indexes.map(function (index) {
            var entry = _.find(this.props.sequences, {index: index});

            if (entry.sequence.length > maxSequenceLength) maxSequenceLength = entry.sequence.length;

            entry.minE = 10;

            entry.subs = _.filter(this.props.orfs, {index: index}).map(function (orf) {
                var extra = {
                    hmms: _.filter(this.props.hmms, {index: orf.index, orf_index: orf.orf_index})
                };

                extra.minE = _.reduce(extra.hmms, function (min, n) {
                    return n.full_e < min ? n.full_e: min;
                }, 10);

                if (entry.minE > extra.minE) entry.minE = extra.minE;

                return _.assign({}, orf, extra);

            }, this);

            entry.subs = _.sortBy(entry.subs, 'pos[0]');

            return entry;

        }, this);

        composites = _.sortBy(composites, 'minE');

        var diagramComponents = composites.map(function (composite, index) {
            return (
                <Diagram
                    key={index}
                    {...composite}
                    maxSequenceLength={maxSequenceLength}
                    showPopover={this.props.showPopover}
                    hidePopover={this.props.hidePopover}
                    content={this.props.content}
                />
            );
        }, this);

        return (
            <ListGroup>
                {diagramComponents}
            </ListGroup>
        );
    }
});

module.exports = List;