var React = require('react');
var Table = require('react-bootstrap/lib/Table');
var Label = require('react-bootstrap/lib/Label');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Tooltip = require('virtool/js/components/Base/Tooltip.jsx');

var NuVsTooltip = React.createClass({
    render: function () {

        var data = this.props.content;

        var x = this.props.x + 75;
        var y = this.props.y + this.props.container.offsetTop + 75;
        
        return (
            <Tooltip x={x} y={y} header={'ORF ' + data.orf_index}>
                <Table condensed bordered>
                    <tbody>
                    <tr>
                        <td>Candidate Definitions</td>
                        <td>{data.hmms[0].definition.join(" | ")}</td>
                    </tr>
                    <tr>
                        <td>E-value</td>
                        <td>{data.hmms[0].full_e}</td>
                    </tr>
                    <tr>
                        <td>Score</td>
                        <td>{data.hmms[0].full_score}</td>
                    </tr>
                    <tr>
                        <td>Position</td>
                        <td>{data.pos[0]} {data.strand === 1 ? '→' : '←'} {data.pos[1]}</td>
                    </tr>
                    <tr>
                        <td>Strand</td>
                        <td>
                            <Icon
                                name={data.strand === 1 ? 'plus-square': 'minus-square'}
                                bsStyle={data.strand === 1 ? 'primary': 'danger'}
                            />
                        </td>
                    </tr>
                    <tr>
                        <td>Frame</td>
                        <td>{data.frame}</td>
                    </tr>
                    </tbody>
                </Table>
            </Tooltip>
        );
    }
});

module.exports = NuVsTooltip;