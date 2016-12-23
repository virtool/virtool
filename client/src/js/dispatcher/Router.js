/**
 * Copyright 2015, Government of Canada.
 * All rights reserved.
 *
 * This source code is licensed under the MIT license.
 *
 * @providesModule Collection *
 */
import Events from "./Events";

import ManageSamples from 'virtool/js/components/Samples/Manage';


function Router() {

    this.events = new Events(['change'], this);

    this.refreshRoute = function () {

        var fragment = location.hash.replace('#', '').split("/");

        var base = fragment.slice(0, 2);

        // Redirect to homepage if no fragment is specified after '#'.
        if (base[0] === "") {
            location.hash = "home/welcome";
            return;
        }

        // If we get this far, a parent is specified in the base of the route. Get its children.
        var children = _.find(this.structure, {key: base[0]}).children;

        // Update the route attribute and emit a route change event if a child is specified.
        if (base.length > 1) {
            this.route = {
                fragment: fragment,
                base: base,
                extra: fragment.slice(2),
                parent: base[0],
                child: base[1],

                children: children,
                baseComponent: _.find(children, {key: base[1]}).component
            };

            this.emit('change', this.route);

            return this.route;
        }

        // Redirect to the parent's first child if no child is specified.
        location.hash = base[0] + "/" + children[0].key;
    };

    // Change the route when there is the URL in the address bar is changed.
    window.onhashchange = (function () {
        // Update active states
        this.clearActive();
        this.refreshRoute();
    }).bind(this);

    // An object describing all of the routes for the application.
    this.structure = [
        
        {
            key: 'home',
            icon: 'home',

            children: [
                {key: 'welcome', component: require('virtool/js/components/Home/Welcome')}
            ]
        },

        {
            key: 'jobs',
            icon: 'briefcase',

            children: [
                {key: 'manage', component: require('virtool/js/components/Jobs/Manage')}
            ]
        },

        {
            key: 'samples',
            icon: 'filing',

            children: [
                {key: 'manage', component: ManageSamples},
                {key: 'files', component: require('virtool/js/components/Samples/Files')}
            ]
        },

        {
            key: 'viruses',
            icon: 'search',

            children: [
                {key: 'manage', component: require('virtool/js/components/Viruses/Manage')},
                {key: 'history', component: require('virtool/js/components/Viruses/History')},
                {key: 'index', component: require('virtool/js/components/Viruses/Index')},
                {key: 'hmm', label: 'HMM', component: require('virtool/js/components/Viruses/HMM')}
            ]
        },

        {
            key: 'hosts',
            icon: 'leaf',

            children: [
                {key: 'manage', component: require('virtool/js/components/Hosts/Manage')}
            ]
        },

        {
            key: 'options',
            icon: 'wrench',

            children: [
                {key: 'general', component: require('virtool/js/components/Options/General')},
                {key: 'server', component: require('virtool/js/components/Options/Server')},
                {key: 'data', component: require('virtool/js/components/Options/Data')},
                {key: 'jobs', component: require('virtool/js/components/Options/Jobs')},
                {key: 'users', component: require('virtool/js/components/Options/Users')}
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
        var fragment = [parentKey, _.find(this.structure, {key: parentKey}).children[0].key];
        location.hash = fragment.join("/");
    };

    this.setChild = function (childKey) {
        location.hash = [this.route.parent, childKey].join("/");
    };

    this.setExtra = function (extra) {
        var fragment = this.route.fragment.slice(0, 2).concat(extra);
        location.hash = fragment.join("/");
    };

    this.clearExtra = function () {
        this.setExtra([]);
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