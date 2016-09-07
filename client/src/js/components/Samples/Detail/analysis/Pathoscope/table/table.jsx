var _ = require('lodash');
var Numeral = require('numeral');
var React = require('react');
var FlipMove = require('react-flip-move');
var Label = require('react-bootstrap/lib/Label');
var Table = require('react-bootstrap/lib/Table');

var Utils = require('virtool/js/Utils');
var Header = require('./header.jsx');

var AnalysisTable = React.createClass({

    getInitialState: function () {
        return {
            sortedBy: 'coverage',
            descending: true
        }
    },

    sortTable: function (property) {
        // Reverse the sort order if the table is already sorted by the clicked property
        if (this.state.sortedBy === property) {
            this.setState({'descending': !this.state.descending});
        }
        // Otherwise sort by the new property
        else {
            this.setState({'sortedBy': property});
        }
    },

    render: function () {

        var data = this.props.data;

        data = _.sortBy(data, this.state.sortedBy);

        if (this.state.descending) data = data.reverse();

        var rowComponents = data.map(function (virus) {

            var abbreviation = virus.abbreviation ? <Label>{virus.abbreviation}</Label>: null;

            var relative = this.props.useRelative ? <td>{Utils.toScientificNotation(virus.relative)}</td>: null;

            var pi = this.props.proportion ? Utils.toScientificNotation(virus.pi): Math.round(virus.pi * this.props.totalReadsMapped);

            var best = this.props.proportion ? Utils.toScientificNotation(virus.best): Math.round(virus.best * this.props.totalReadsMapped);

            var rowClass = this.props.useRelative && this.props.internalControlId === virus._id ? 'info': undefined;

            return (
                <tr key={virus._id} className={rowClass}>
                    <td>{virus.name} {abbreviation}</td>
                    <td>{pi}</td>
                    <td>{best}</td>
                    {relative}
                    <td>{Numeral(virus.coverage).format('0.000')}</td>
                </tr>
            );
        }, this);

        return (
            <Table fill>
                <Header {...this.state} sortTable={this.sortTable} useRelative={this.props.useRelative} />
                <FlipMove typeName="tbody" leaveAnimation={false}>
                    {rowComponents}
                </FlipMove>
            </Table>
        );
    }

});

module.exports = AnalysisTable;