var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Well = require('react-bootstrap/lib/Well');
var ButtonGroup = require('react-bootstrap/lib/ButtonGroup');
var ButtonToolbar = require('react-bootstrap/lib/ButtonToolbar');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');
var Button = require('virtool/js/components/Base/PushButton.jsx');

var ControlBar = React.createClass({

    composite: function () {
        this.props.setMode('composite');
    },

    hmm: function () {
        this.props.setMode('hmm');
    },

    orf: function () {
        this.props.setMode('orf');
    },

    render: function () {

        var buttonProps = {
            bsSize: 'small',
            onClick: this.handleClick
        };

        return (
            <ButtonToolbar>
                <Button active={this.props.filterHMM} {...buttonProps} onClick={this.props.toggleFilterHMM}>
                    <Icon name='filter' /> Filter HMM
                </Button>

                <Button active={this.props.filterORF} {...buttonProps} onClick={this.props.toggleFilterORF}>
                    <Icon name='filter' /> Filter ORF
                </Button>
            </ButtonToolbar>
        );
    }

});

module.exports = ControlBar;