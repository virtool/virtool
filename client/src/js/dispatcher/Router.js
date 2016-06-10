/**
 * Copyright 2015, Government of Canada.
 * All rights reserved.
 *
 * This source code is licensed under the MIT license.
 *
 * @providesModule Collection *
 */

var Events = require('./Events');

function Router() {

    this.events = new Events(['change'], this);

    this.current = function () {
        return window.location.hash.replace('#', '');
    };

    // Change the route when there is the URL in the address bar is changed.
    window.onhashchange = (function () {
        // Update active states
        this.clearActive();
        var route = this.current();
        var splitRoute = route.split('/');
        this.routes[splitRoute[0]].active = true;
        this.routes[splitRoute[0]].children[splitRoute[1]].active = true;

        this.emit('change', route);
    }).bind(this);

    // An object describing all of the routes for the application.
    this.routes = {

        home: {
            icon: 'home',
            active: true,
            children: {
                welcome: {label: 'welcome', active: true}
            }
        },

        jobs: {
            icon: 'briefcase',
            active: false,
            children: {
                active: {label: 'active', active: true},
                archived: {label: 'archived', active: false}
            }
        },

        samples: {
            icon: 'filing',
            active: false,
            children: {
                active: {label: 'active', active: true},
                archived: {label: 'archived', active: false}
            }
        },

        viruses: {
            icon: 'search',
            active: false,
            children: {
                manage: {label: 'manage', active: true},
                history: {label: 'history', active: false},
                index: {label: 'index', active: false}
            }
        },

        hosts: {
            icon: 'leaf',
            active: false,
            children: {
                manage: {label: 'manage', active: true}
            }
        },

        options: {
            icon: 'wrench',
            active: false,
            children: {
                general: {label: 'general', active: true},
                server: {label: 'server', active: false},
                data: {label: 'data', active: false},
                jobs: {label: 'jobs', active: false},
                users: {label: 'users', active: false}
            }
        }
    };

    /**
     * Return an array of all the child routes for given major route.
     *
     * @param majorRoute {string} - The major route to return children for (eg. samples)
     * @returns {Array} - An array of children (eg. {label: 'users', active: false})
     */
    this.children = function (majorRoute) {
        var children = this.routes[majorRoute].children;
        var list = [];

        // Push all of the children for the major route into the list.
        for (var childKey in children) {
            if (children.hasOwnProperty(childKey)) {
                list.push(children[childKey]);
            }
        }

        return list;
    };


    // Clear active states of all routes
    this.clearActive = function () {
        for (var primary in this.routes) {
            if (this.routes.hasOwnProperty(primary)) {
                // Set all primary routes in inactive.
                this.routes[primary].active = false;

                // Set all secondary routes to inactive.
                var secondaries = this.routes[primary].children;
                for (var secondary in secondaries) {
                    if (secondaries.hasOwnProperty(secondary)) {
                        secondaries[secondary].active = false;
                    }
                }
            }
        }
    };

    /**
     * Takes a full forward-slash separated route, changes the URL.
     *
     * @param route {string} - The route to be swapped into the URL.
     */
    this.route = function (route) {
        // Change the hash link in the URL bar
        window.location.hash = route;
    };

    /**
     * Change the primary routes that are defined in the main navigation bar. The first (primary) part of the URL is
     * replaced with the given primary route and the second part is the first child route available for this primary.
     *
     * @param target {string}
     */
    this.primary = function (target) {
        // Get a list of the possible children for the new primary route.
        var children = this.children(target);

        // Generate a new URL using the given primary route and the first child route for this primary.
        var link = target + '/' + children[0].label;

        // Change the URL proper and send out event.
        this.route(link);
    };

    /**
     * Change the secondary route. In the secondary navigation bar, link colors will be changed to reflect the route
     * change.
     *
     * @param target {string}
     */
    this.secondary = function (target) {
        // Split the route for handling
        var split = window.location.hash.replace('#', '').split('/');

        // Make the new URL and and change the current route
        this.route(split[0] + '/' + target);
    };

    this.primary('home');
}

module.exports = Router;