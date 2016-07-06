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

    this.refreshRoute = function () {

        var uri = URI(location);

        var full = uri.fragment();

        console.log(full);

        var split = full.split("/");

        var base = split.slice(0, 2);

        if (base.length === 1) base += this.childKeys(base[0])[0];

        var children = _.find(this.structure, {key: base[0]}).children;

        var child = _.find(children, {key: base[1]});

        var newRoute = {
            full: full,
            base: base,
            extra: split.slice(2),
            query: uri.query(),
            parent: base[0],
            child: base[1],

            children: children,
            baseComponent: child.component
        };

        this.route = newRoute;

        return newRoute;
    };

    // Change the route when there is the URL in the address bar is changed.
    window.onhashchange = (function () {
        // Update active states
        this.clearActive();

        this.emit('change', this.refreshRoute());
    }).bind(this);

    // An object describing all of the routes for the application.
    this.structure = [
        
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

    this.structure.forEach(function (base, index) {
        base.active = index === 0;

        base.children.forEach(function (child) {
            child.active = index === 0;
        });
    });

    this.setParent = function (parentKey) {
        var split = this.route.full.split("/");
        split[0] = parentKey;
        split[1] = _.find(this.structure, {key: parentKey}).children[0].key;
        location.replace("#" + split.join("/"));
    };

    this.setChild = function (childKey) {
        var split = this.route.full.split("/");
        split[1] = childKey;
        location.replace("#" + split.join("/"));
    };

    // Clear active states of all routes
    this.clearActive = function () {
        this.structure.forEach(function (parent) {
            parent.active = false;

            parent.children.forEach(function (child) {
                child.active = false;
            });
        });
    };

    this.route = this.refreshRoute();
}

module.exports = Router;