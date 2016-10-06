var _ = require('lodash');
var React = require('react');
var Numeral = require('numeral');
var Table = require('react-bootstrap/lib/Table');

var Tooltip = require('virtool/js/components/Base/Tooltip.jsx');
var Coverage = require('./coverage.jsx');

var formatNumber = function (number) {
    return Numeral(number).format('0.0000');
};

var PathoscopeTooltip = React.createClass({

    render: function () {
        var data = this.props.barGroupData;

        var definitionRow;
        var header = data.name || null;
        var coverage;

        if (_.has(data, 'accession')) {
            header = data.accession;
            coverage = <Coverage data={data.align} />;
            definitionRow = [
                (
                    <tr key='definition'>
                        <th>Definition</th>
                        <td>{data.definition}</td>
                    </tr>
                )
            ];
        }

        var table = (
            <Table condensed bordered>
                <tbody>
                    {definitionRow}
                    <tr key='bestHit'>
                        <th>Best-hit</th>
                        <td>{formatNumber(data.best)}</td>
                    </tr>
                    <tr key='coverage'>
                        <th>Coverage</th>
                        <td>{formatNumber(data.coverage)}</td>
                    </tr>
                    <tr key='weight'>
                        <th>Weight</th>
                        <td>{formatNumber(data.pi)}</td>
                    </tr>
                </tbody>
            </Table>
        );

        return (
            <Tooltip x={this.props.x} y={this.props.y} header={header}>
                {table}
                {coverage}
            </Tooltip>
        );
    }

});

module.exports = PathoscopeTooltip;