var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Well = require('react-bootstrap/lib/Well');
var ButtonGroup = require('react-bootstrap/lib/ButtonGroup');
var ButtonToolbar = require('react-bootstrap/lib/ButtonToolbar');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

var Level = require("!jsx!./level.jsx");

var ControlBar = React.createClass({

    handleClickTable: function () {
        this.props.setMode("table");
    },

    handleClickChart: function () {
        this.props.setMode("chart");
    },

    handleClickFilter: function () {
        this.props.toggleState('filter');
    },

    handleClickControl: function () {
        this.props.toggleState('control');
    },

    handleClickProportion: function () {
        this.props.toggleState('proportion');
    },

    handleClickQuery: function () {
        this.props.toggleState('query');
    },

    render: function () {

        var buttonProps = {
            bsSize: 'small'
        };

        var level;
        var queryButton;
        var proportionButton;

        if (this.props.mode === 'chart') {
            level = <Level handleUp={this.handleUp} {...this.props} />;

            queryButton = (
                <PushButton {...buttonProps} onClick={this.handleClickQuery} active={this.props.query}>
                    <Icon name='question' /> Query
                </PushButton>
            );
        } else {
            proportionButton = (
                <PushButton {...buttonProps} onClick={this.handleClickProportion} active={this.props.proportion}>
                    <Icon name='pie' /> Proportion
                </PushButton>
            )
        }

        var buttons = (
            <ButtonToolbar block={false}>
                <ButtonGroup>
                    <PushButton {...buttonProps} onClick={this.handleClickTable} active={this.props.mode === 'table'}>
                        <Icon name='table' /> Table
                    </PushButton>

                    <PushButton {...buttonProps} onClick={this.handleClickChart} active={this.props.mode === 'chart'}>
                        <Icon name='bars' /> Chart
                    </PushButton>
                </ButtonGroup>

                {proportionButton}

                <PushButton {...buttonProps} onClick={this.handleClickFilter} active={this.props.filter}>
                    <Icon name='filter' /> Filter
                </PushButton>

                <PushButton {...buttonProps} onClick={this.handleClickControl} active={this.props.control} disabled={this.props.disableControl}>
                    <Icon name='meter' /> Control
                </PushButton>

                {queryButton}

            </ButtonToolbar>
        );

        var titleStyle = {
            border: '1px solid #e3e3e3',
            backgroundColor: 'white',
            padding: '4px',
            marginBottom: '10px'
        };

        return (
            <Flex>
                <Flex.Item>
                    {buttons}
                </Flex.Item>

                <Flex.Item grow={1} pad={5}>
                    {level}
                </Flex.Item>
            </Flex>
        );
    }

});

module.exports = ControlBar;