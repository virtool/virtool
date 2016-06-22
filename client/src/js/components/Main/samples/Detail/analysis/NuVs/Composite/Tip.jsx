var d3 = require('d3');
var React = require('react');
var Table = require('react-bootstrap/lib/Table');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Tooltip = require('virtool/js/components/Base/Tooltip.jsx');
var Diagram = require('./Diagram.jsx');


var Report = React.createClass({

    getInitialState: function () {
        return {
            content: null,
            x: null,
            y: null
        };
    },

    componentWillReceiveProps: function (nextProps) {
        
    },

    showPopover: function (d, x, y) {
        if (!this.state.content) {
            this.setState({
                content: d,
                x: x,
                y: y
            });
        }
    },

    hidePopover: function () {
        this.setState({
            content: null,
            x: null,
            y: null
        });
    },

    render: function () {

        var diagramComponents = composites.map(function (composite, index) {
            return (
                <Diagram
                    key={index}
                    {...composite}
                    showPopover={this.showPopover}
                    hidePopover={this.hidePopover}
                    content={this.state.content}
                    maxSequenceLength={maxSequenceLength}
                />
            );
        }, this);

        var popover;

        if (this.state.content) {
            var data = this.state.content;

            popover = (
                <Tooltip x={this.state.x} y={this.state.y} header={'ORF ' + data.orf_index}>
                    <Table condensed bordered>
                        <tbody>
                        <tr>
                            <td>Candidate Definition</td>
                            <td>{data.hmms[0].definition}</td>
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

        return (
            <div>
                <ListGroup>
                    {diagramComponents}
                </ListGroup>
                {popover}
            </div>
        );
    }
});

module.exports = Report;