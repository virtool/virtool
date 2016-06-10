/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Icon
 */

'use strict';

var CX = require('classnames');
var React = require('react');

/**
 * Wrapper an IcoMoon icon in an easy React interface.
 *
 * @class
 */
var Icon = React.createClass({

    propTypes: {
        name: React.PropTypes.string.isRequired,
        onClick: React.PropTypes.func,
        pending: React.PropTypes.bool,
        bsStyle: React.PropTypes.string,
        className: React.PropTypes.string,
        pullRight: React.PropTypes.bool,
        fixedWidth: React.PropTypes.bool,
        style: React.PropTypes.object,
        pad: React.PropTypes.bool
    },

    getDefaultProps: function () {
        return {
            pending: false,
            pullRight: false,
            fixedWidth: false
        };
    },

    /**
     * Handles click event by stopping propagation of the click event and calling the onClick prop function.
     *
     * @param event {object} - the click event.
     * @func
     */
    handleClick: function (event) {
        event.stopPropagation();
        this.props.onClick(event);
    },

    render: function () {
        var classDefinition = {
            'pull-right': this.props.pullRight,
            'fixed-width': this.props.fixedWidth
        };

        var style = {};

        if (this.props.pad) style.marginLeft = '3px';

        _.assign(style, this.props.style);

        // Should the icon be a spinner icon or the icon name passed in props?
        classDefinition[this.props.pending ? 'i-spinner spinner': ('i-' + this.props.name)] = true;

        // Does the icon need a Bootstrap text style?
        if (this.props.bsStyle && !this.props.pending) classDefinition['text-' + this.props.bsStyle] = true;

        // If the icon calls a function onClick, it should be hoverable.
        if (this.props.onClick) classDefinition['hoverable pointer'] = true;

        var className = CX(classDefinition);

        if (this.props.className) className += ' ' + this.props.className;

        return <i className={className} onClick={this.props.onClick ? this.handleClick: null} style={style} />;
    }
});

module.exports = Icon;