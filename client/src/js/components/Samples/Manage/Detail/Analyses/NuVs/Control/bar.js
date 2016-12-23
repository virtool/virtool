"use strict";

import React from "react";
import { ButtonToolbar } from 'react-bootstrap';
import { Icon, Button } from 'virtool/js/components/Base';

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