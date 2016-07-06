/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports PrimaryButton
 */

'use strict';

var _ = require('lodash');
var React = require('react');
var NavItem = require('react-bootstrap/lib/NavItem');
var Icon = require('virtool/js/components/Base/Icon.jsx');

/**
 * A component that renders to a primary link in the primary navbar.
 */
var PrimaryButton = React.createClass({

    getInitialState: function () {
        // The only state is whether the button is active or not. Initially it is active only if its route is home.
        return {active: this.props.route === 'Home'};
    },

    componentDidMount: function () {
        dispatcher.router.on('change', this.onRouteChange);
    },

    componentWillUnmount: function () {
        dispatcher.router.off('change', this.onRouteChange);
    },

    shouldComponentUpdate: function (nextProps, nextState) {
        return nextState.active !== this.state.active;
    },

    /**
     * Callback triggered by a change in route. Sets state.active to true if the new primary route is the same as the
     * button's route.
     *
     * @param route {string} - the new route URL.
     * @func
     */
    onRouteChange: function (route) {
        this.setState({active: route.parent === this.parentKey});
    },

    /**
     * Callback triggered by clicking on the primary button. Changes the primary route in the router to that
     * associated with the button.
     *
     * @param event {object} - the click event.
     */
    handleClick: function (event) {
        event.preventDefault();
        dispatcher.router.setParent(this.props.parentKey);
    },

    render: function () {
        return (
            <NavItem onClick={this.handleClick} className='pointer' active={this.state.active}>
                <Icon name={this.props.iconName} />  {this.props.label || _.capitalize(this.props.parentKey)}
            </NavItem>
        );
    }
});

module.exports = PrimaryButton;