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
        this.props.router.on('change', this.onRouteChange);
    },

    componentWillUnmount: function () {
        this.props.router.off('change', this.onRouteChange);
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
        route = route.split('/')[0];
        this.setState({active: route === this.props.route.toLowerCase()});
    },

    /**
     * Callback triggered by clicking on the primary button. Changes the primary route in the router to that
     * associated with the button.
     *
     * @param event {object} - the click event.
     */
    handleClick: function (event) {
        event.preventDefault();
        this.props.router.primary(this.props.route.toLowerCase());
    },

    render: function () {
        var routeData = this.props.router.routes[this.props.route];

        return (
            <NavItem onClick={this.handleClick} className='pointer' active={this.state.active}>
                <Icon name={routeData.icon} />  {_.capitalize(this.props.route)}
            </NavItem>
        );
    }
});

module.exports = PrimaryButton;