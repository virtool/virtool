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

import React from "react";
import Nav from "./Nav/Bar";

export default class Main extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            route: dispatcher.router.route
        }
    }

    componentDidMount () {
        dispatcher.router.on("change", this.onRouteChange);
    }

    componentWillUnmount () {
        dispatcher.router.off("change", this.onRouteChange);
    }

    onRouteChange = (route) => this.setState({route: route});

    render = () => (
        <div id="app" style={{display: "flex", flexFlow: "column nowrap"}}>
            <Nav style={{flex: "0 0 auto"}} />
            <div style={{flex: "1 0 auto"}}>
                <div className="container-fluid" id="content-display" style={{flex: "1 0 auto"}}>
                    <this.state.route.baseComponent route={this.state.route} />
                </div>
            </div>
        </div>
    );
}
