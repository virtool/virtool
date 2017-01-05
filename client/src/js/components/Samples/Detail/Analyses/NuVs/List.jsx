var _ = require('lodash');
var React = require('react');
var FlipMove = require('react-flip-move');

var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Label = require('react-bootstrap/lib/Label');
var Table = require('react-bootstrap/lib/Table');
var Panel = require('react-bootstrap/lib/Panel');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');
var FormGroup = require('react-bootstrap/lib/FormGroup');
var InputGroup = require('react-bootstrap/lib/InputGroup');
var FormControl = require('react-bootstrap/lib/FormControl');
var Dropdown = require('react-bootstrap/lib/Dropdown');
var MenuItem = require('react-bootstrap/lib/MenuItem');

var Flex = require('virtool/js/components/Base/Flex.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');

var Button = require('virtool/js/components/Base/PushButton.jsx');
var Checkbox = require('virtool/js/components/Base/Checkbox.jsx');

var NuVsEntry = require('./Entry.jsx');
var NuVsExpansion = require('./Expansion.jsx');

var NuVsList = React.createClass({

    propTypes: {
        data: React.PropTypes.arrayOf(React.PropTypes.object)
    },

    getInitialState: function () {
        return {
            expanded: []
        };
    },

    toggleIn: function (sequenceIndex) {
        this.setState({
            expanded: _.xor(this.state.expanded, [sequenceIndex])
        });
    },

    collapseAll: function () {
        this.setState({
            expanded: []
        });
    },

    render: function () {

        var data = this.props.data;

        if (this.state.filterORFs) {
            data = data.map(function (sequence) {
                return _.assign({}, sequence, {orfs: _.filter(sequence.orfs, {hasHmm: true})});
            });
        }

        if (this.state.filterSequences) {
            data = _.filter(data, function (sequence) {
                return sequence.hasSignificantOrf;
            });
        }

        var rows = data.map(function (item, index) {

            var expanded = _.includes(this.state.expanded, item.index);

            var components = [
                <NuVsEntry
                    key={"sequence_" + item.index}
                    {...item}
                    toggleIn={this.toggleIn}
                    in={expanded}
                />
            ];

            if (expanded) {
                components.push(
                    <NuVsExpansion
                        key={index}
                        {...item}
                        analysisId={this.props.analysisId}
                        maxSequenceLength={this.props.maxSequenceLength}
                    />
                );
            }

            return components;

        }, this);

        rows = _.flatten(rows);

        return (
            <div>
                <FlipMove typeName="div" className="list-group" enterAnimation="accordianVertical" leaveAnimation={false}>
                    {rows}
                </FlipMove>
            </div>
        );
    }

});

module.exports = NuVsList;