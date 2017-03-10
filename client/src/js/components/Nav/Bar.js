/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Bar
 */

import React from "react";
import { forIn } from "lodash";
import ChildBar from "./Child/Bar";
import ParentBar from "./Parent/Bar";
import LostConnection from "./LostConnection";

/**
 * A container component that renders the primary and secondary navigation bars.
 */
export default class Bar extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            closed: false
        };
    }

    componentDidMount () {
        dispatcher.on("closed", this.showLostConnection);
    }

    componentWillUnmount () {
        dispatcher.off("closed", this.showLostConnection);
    }

    showLostConnection = () => {
        forIn(dispatcher.db.collectionNames, collectionName => {
            dispatcher.db[collectionName].clear();
        });

        dispatcher.db.loki.saveDatabase(() => this.setState({closed: true}));
    };

    render = () => (
        <div>
            <ParentBar />
            <ChildBar />
            <LostConnection
                show={this.state.closed}
                onHide={this.showLostConnection}
            />
        </div>
    );
}
