var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Well = require('react-bootstrap/lib/Well');
var ButtonGroup = require('react-bootstrap/lib/ButtonGroup');
var ButtonToolbar = require('react-bootstrap/lib/ButtonToolbar');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

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
            <Flex>
                <Flex.Item>
                    <ButtonGroup>
                        <PushButton active={this.props.mode === 'composite'} {...buttonProps} onClick={this.composite}>
                            <Icon name='bars' /> Composite
                        </PushButton>
                        <PushButton active={this.props.mode === 'hmm'} {...buttonProps} onClick={this.hmm}>
                            <Icon name='search' /> HMMs
                        </PushButton>
                        <PushButton active={this.props.mode === 'orf'} {...buttonProps} onClick={this.orf}>
                            <Icon name='' /> ORFs
                        </PushButton>
                    </ButtonGroup>
                </Flex.Item>
            </Flex>
        );
    }

});

module.exports = ControlBar;