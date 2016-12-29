/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SecondaryNavbar
 */

import React from "react";
import ChildButton from "./Button";

/**
 * The secondary navbar which display child routes of the active primary route.
 */
export default class ChildBar extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            activeChild: dispatcher.router.route.child,
            children: dispatcher.router.route.children
        }
    }

    componentDidMount () {
        dispatcher.router.on("change", this.onRouteChange);
    }

    componentWillUnmount () {
        dispatcher.router.off("change", this.onRouteChange);
    }

    /**
     * Changes the child route documents when the route changes. Called in response to a change event in the router.
     *
     * @param route
     * @func
     */
    onRouteChange = (route) => {
        this.setState({
            activeChild: route.child,
            children: route.children
        });
    };

    render () {

        // Each button component shows up in the secondary navbar.
        const buttonComponents = this.state.children.map((child) => {
            return (
                <ChildButton
                    {...child}
                    childKey={child.key}
                    active={child.key === this.state.activeChild}
                />
            );
        });

        return (
            <ol className="subnav">
                {buttonComponents}
            </ol>
        );
    }
}
