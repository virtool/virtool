/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Index
 */

import React from "react";
import FlipMove from "react-flip-move"
import { sortBy } from "lodash-es";
import { Alert } from "react-bootstrap";
import { Icon } from "virtool/js/components/Base";

import Entry from "./Index/Entry";
import Rebuild from "./Index/Rebuild";

const getInitialState = () => ({
    historyEntries: dispatcher.db.history.find(),
    indexEntries: dispatcher.db.indexes.find()
});

/**
 * A main component that shows a history of all index builds and the changes that comprised them.
 *
 * @class
 */
export default class ManageIndexes extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    componentDidMount () {
        dispatcher.db.indexes.on("change", this.update);
        dispatcher.db.history.on("change", this.update);
        dispatcher.db.viruses.on("change", this.update);
    }

    componentWillUnmount () {
        dispatcher.db.indexes.off("change", this.update);
        dispatcher.db.history.off("change", this.update);
        dispatcher.db.viruses.off("change", this.update);
    }

    /**
     * Refresh state when the index or history collection changes. Triggered by a collection "update" event.
     *
     * @func
     */
    update = () => {
        this.setState(getInitialState());
    };

    render () {

        if (dispatcher.db.viruses.count() > 0) {
            // Set to true when a ready index has been seen when mapping through the index documents. Used to mark only
            // the newest ready index with a checkmark in the index list.
            let haveSeenReady = false;

            // Render a ListGroupItem for each index version. Mark the first ready index with a checkmark by setting the
            // showReady prop to true.
            const indexComponents = sortBy(this.state.indexEntries, "index_version").reverse().map((document) => {
                haveSeenReady = document.ready;
                return <Entry key={document._id} showReady={!document.ready || !haveSeenReady} {...document} />;
            });

            return (
                <div>
                    <Rebuild
                        documents={this.state.historyEntries}
                        collection={dispatcher.db.viruses}
                    />
                    <FlipMove typeName="div" className="list-group">
                        {indexComponents}
                    </FlipMove>
                </div>
            );
        }

        return (
            <Alert bsStyle="warning">
                <Icon name="warning" /> At least one virus must be added to the database before an index can be built.
            </Alert>
        );
    }

}
