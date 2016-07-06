/**
 * Copyright 2015, Government of Canada.
 * All rights reserved.
 *
 * This source code is licensed under the MIT license.
 *
 * @providesModule Collection *
 */

var Events = require('./Events');
var URI = require('urijs');

window.urijs = URI;


function Router() {

    this.events = new Events(['change'], this);

    this.getCurrentRoute = function () {

        var uri = URI(location);

        var full = uri.fragment();

        var split = full.split("/");

        var base = split.slice(0, 2);

        if (base.length === 1) base += this.childKeys(base[0])[0];

        return {
            full: full,
            base: base,
            baseComponent: _.find(_.find(this.bases, {key: base[0]}).children, {key: base[1]}).component,
            extra: split.slice(2),
            query: uri.query()
        };
    };

    // Change the route when there is the URL in the address bar is changed.
    window.onhashchange = (function () {
        // Update active states
        this.clearActive();

        this.emit('change', this.getCurrentRoute());
    }).bind(this);

    // An object describing all of the routes for the application.
    this.bases = [
        
        {
            key: 'home',
            icon: 'home',

            children: [
                {key: 'welcome', component: require('virtool/js/components/Home/Welcome.jsx')}
            ]
        },

        {
            key: 'jobs',
            icon: 'briefcase',

            children: [
                {key: 'active', component: require('virtool/js/components/Jobs/Active.jsx')},
                {key: 'archived', component: require('virtool/js/components/Jobs/Archived.jsx')}
            ]
        },

        {
            key: 'samples',
            icon: 'filing',

            children: [
                {key: 'active', component: require('virtool/js/components/Samples/Active.jsx')},
                {key: 'archived', component: require('virtool/js/components/Samples/Archived.jsx')}
            ]
        },

        {
            key: 'viruses',
            icon: 'search',

            children: [
                {key: 'manage', component: require('virtool/js/components/Viruses/Manage.jsx')},
                {key: 'history', component: require('virtool/js/components/Viruses/History.jsx')},
                {key: 'index', component: require('virtool/js/components/Viruses/Index.jsx')}
            ]
        },

        {
            key: 'hosts',
            icon: 'leaf',

            children: [
                {key: 'manage', component: require('virtool/js/components/Hosts/Manage.jsx')}
            ]
        },

        {
            key: 'options',
            icon: 'wrench',

            children: [
                {key: 'general', component: require('virtool/js/components/Options/General.jsx')},
                {key: 'server', component: require('virtool/js/components/Options/Server.jsx')},
                {key: 'data', component: require('virtool/js/components/Options/Data.jsx')},
                {key: 'jobs', component: require('virtool/js/components/Options/Jobs.jsx')},
                {key: 'users', component: require('virtool/js/components/Options/Users.jsx')}
            ]
        }

    ];

    this.bases.forEach(function (base, index) {
        base.active = index === 0;

        base.children.forEach(function (child) {
            child.active = index === 0;
        });
    });

    /**
     * Return an array of all the child routes for given major route.
     *
     * @param primary {string} - The primary route to return children for (eg. samples)
     * @returns {Array} - An array of children (eg. {label: 'users', active: false})
     */
    this.children = function (primary) {
        return _.find(this.bases, {key: primary}).children;
    };

    this.childKeys = function (primary) {
        return _.map(this.children(primary), 'key');
    };

    // Clear active states of all routes
    this.clearActive = function () {
        this.bases.forEach(function (base) {
            base.active = false;

            base.children.forEach(function (child) {
                child.active = false;
            });
        });
    };
}

module.exports = Router;