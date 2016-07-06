/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Main
 */

'use strict';

var React = require('react');
var Nav = require('virtool/js/components/Nav/Bar.jsx');


var Main = React.createClass({

    getInitialState: function () {
        var route = dispatcher.router.current().split('/');

        return {
            primaryRoute: splitRoute[0],
            secondaryRoute: splitRoute[1]
        };
    },

    componentDidMount: function () {
        dispatcher.router.on('change', this.onRouteChange);
    },

    componentWillUnmount: function () {
        dispatcher.router.off('change', this.onRouteChange);
    },

    /**
     * Sets state to reflect the current route. Called in response to a 'change' event from the router.
     * @func
     */
    onRouteChange: function () {
        this.setState(this.getInitialState());
    },

    render: function () {
        // Get a View component based on the primary and secondary parts of the split route.
        var View = views[this.state.primaryRoute][this.state.secondaryRoute];

        var containerStyle = {
            display: 'flex',
            flexFlow: 'column nowrap'
        };

        var navStyle = {
            flex: '0 0 auto'
        };

        var contentStyle = {
            flex: '1 0 auto'
        };

        return (
            <div id='app' style={containerStyle}>
                <Nav style={navStyle} />
                <div style={contentStyle}>
                    <div className='container-fluid' id='content-display' style={contentStyle}>
                        <View />
                    </div>
                </div>
            </div>
        );
    }
});

module.exports = Main;