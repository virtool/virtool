/**
 * Copyright 2015, Government of Canada.
 * All rights reserved.
 *
 * This source code is licensed under the MIT license.
 *
 * @providesModule Collection *
 */

import { assign, find } from "lodash";
import Events from "./events";

import WelcomeView from "virtool/js/components/Home/Welcome";

import ManageJobs from "virtool/js/components/Jobs/Manage";

import ManageSamples from "virtool/js/components/Samples/Manage";
import ReadFiles from "virtool/js/components/Samples/Files"

import ManageViruses from "virtool/js/components/Viruses/Manage";
import VirusHistory from "virtool/js/components/Viruses/History";
import ManageIndexes from "virtool/js/components/Viruses/Index";
import ManageHMM from "virtool/js/components/Viruses/HMM";

import SubtractionHosts from "virtool/js/components/Subtraction/Hosts";
import SubtractionFiles from "virtool/js/components/Subtraction/Files";

import GeneralOptions from "virtool/js/components/Options/General";
import ServerOptions from "virtool/js/components/Options/Server";
import UpdateOptions from "virtool/js/components/Options/Updates";
import DataPathOptions from "virtool/js/components/Options/Data";
import JobsOptions from "virtool/js/components/Options/Jobs";
import ManageUsers from "virtool/js/components/Options/Users";

const routerStructure = [
    {
        key: "home",
        icon: "home",

        children: [
            {key: "welcome", component: WelcomeView}
        ]
    },

    {
        key: "jobs",
        icon: "briefcase",

        children: [
            {key: "manage", component: ManageJobs}
        ]
    },

    {
        key: "samples",
        icon: "filing",

        children: [
            {key: "manage", component: ManageSamples},
            {key: "files", component: ReadFiles}
        ]
    },

    {
        key: "viruses",
        icon: "search",

        children: [
            {key: "manage", component: ManageViruses},
            {key: "history", component: VirusHistory},
            {key: "index", component: ManageIndexes},
            {key: "hmm", label: "HMM", component: ManageHMM}
        ]
    },

    {
        key: "subtraction",
        icon: "minus-square",

        children: [
            {key: "hosts", component: SubtractionHosts},
            {key: "files", component: SubtractionFiles}
        ]
    },

    {
        key: "options",
        icon: "wrench",

        children: [
            {key: "general", component: GeneralOptions},
            {key: "server", component: ServerOptions},
            {key: "updates", component: UpdateOptions},
            {key: "data", component: DataPathOptions},
            {key: "jobs", component: JobsOptions},
            {key: "users", component: ManageUsers}
        ]
    }
];

export default class Router {

    constructor () {

        window.onhashchange = () => {
            // Update active states
            this.clearActive();
            this.refreshRoute();
        };

        this.events = new Events(["change"], this);
        this.structure = routerStructure.map((base, index) =>
            assign({}, base, {
                active: index === 0,
                children: base.children.map((child, i) => assign({}, child, {active: i === 0}))
            })
        );

        this.route = this.refreshRoute();
    }

    refreshRoute () {

        const fragment = window.location.hash.replace("#", "").split("/");

        const base = fragment.slice(0, 2);

        // Redirect to homepage if no fragment is specified after "#".
        if (base[0] === "") {
            window.location.hash = "home/welcome";
            return;
        }

        // If we get this far, a parent is specified in the base of the route. Get its children.
        const children = find(this.structure, {key: base[0]}).children;

        // Update the route attribute and emit a route change event if a child is specified.
        if (base.length > 1) {
            this.route = {
                fragment: fragment,
                base: base,
                extra: fragment.slice(2),
                parent: base[0],
                child: base[1],

                children: children,
                baseComponent: find(children, {key: base[1]}).component
            };

            this.emit("change", this.route);

            return this.route;
        }

        // Redirect to the parent"s first child if no child is specified.
        window.location.hash = `${base[0]}/${children[0].key}`;
    }

    setParent  (parentKey) {
        const fragment = [parentKey, find(this.structure, {key: parentKey}).children[0].key];
        window.location.hash = fragment.join("/");
    }

    setChild (childKey) {
        window.location.hash = [this.route.parent, childKey].join("/");
    }

    setExtra  (extra) {
        const fragment = this.route.fragment.slice(0, 2).concat(extra);
        window.location.hash = fragment.join("/");
    }

    clearExtra () {
        this.setExtra([]);
    }

    // Clear active states of all routes
    clearActive () {
        this.structure.forEach(parent => {
            parent.active = false;
            parent.children.forEach(child => child.active = false);
        });
    }
}
