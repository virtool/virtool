var _ = require("lodash");
var React = require("react");
var Numeral = require("numeral");
var Table = require("react-bootstrap/lib/Table");

var Coverage = require("./coverage.jsx");

var formatNumber = function (number) {
    return Numeral(number).format("0.0000");
};

var Tooltip = React.createClass({

    render: function () {
        var x = this.props.x;
        var y = this.props.y;

        var tooltipStyle = {
            left: (x - 10) + "px",
            top: (y - window.pageYOffset - 10) + "px",
            zIndex: 10000
        };

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
            <div className='tooltip' style={tooltipStyle}>
                <div className='tooltip-header'>
                    {header}
                </div>
                <div className='tooltip-body'>
                    {table}
                    {coverage}
                </div>
            </div>
        );
    }

});

module.exports = Tooltip;