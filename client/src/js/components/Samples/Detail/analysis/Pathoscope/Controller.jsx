var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Grid = require('react-bootstrap/lib/Grid');
var ButtonGroup = require('react-bootstrap/lib/ButtonGroup');
var ButtonToolbar = require('react-bootstrap/lib/ButtonToolbar');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');
var Input = require('virtool/js/components/Base/Input.jsx');
var Button = require('virtool/js/components/Base/PushButton.jsx');

var PathoscopeList = require('./List.jsx');

var PathoscopeController = React.createClass({

    getInitialState: function () {
        return {
            filter: true,

            findTerm: "",

            sortKey: "coverage",
            sortDescending: true,

            expanded: []
        };
    },

    collapseAll: function () {
        this.setState({
            expanded: []
        });
    },

    toggleIn: function (virusId) {
        this.setState({
            expanded: _.xor(this.state.expanded, [virusId])
        });
    },

    setFindTerm: function (event) {
        this.setState({findTerm: event.target.value});
    },

    toggleFilter: function () {
        this.setState({
            filter: !this.state.filter
        });
    },

    render: function () {

        var data = _.sortBy(this.props.data, "coverage");

        if (this.state.filter) {
            var totalReadsMapped = _.sum(_.map(data, "reads"));

            data = _.filter(data, function (virus) {
                return virus.pi * totalReadsMapped >= virus.ref_length * 0.8 / this.props.maxReadLength;
            }.bind(this));
        }

        if (this.state.sortDescending) {
            data.reverse();
        }

        return (
            <div>
                <div>
                    <Flex>
                        <Flex.Item grow={1}>
                            <Input type="text" value={this.state.findTerm} onChange={this.setFindTerm} />
                        </Flex.Item>

                        <Flex.Item pad>
                            <Button active={this.state.filter} onClick={this.toggleFilter}>
                                <Icon name='filter' /> Filter
                            </Button>
                        </Flex.Item>

                        <Flex.Item pad>
                            <Button onClick={this.collapseAll}>
                                <Icon name='shrink' /> Collapse
                            </Button>
                        </Flex.Item>
                    </Flex>
                </div>

                <PathoscopeList
                    data={data}
                    expanded={this.state.expanded}
                    toggleIn={this.toggleIn}
                />
            </div>
        );
    }

});

module.exports = PathoscopeController;