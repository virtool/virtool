/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports VirusHistoryList
 */


import React from "react";
import FlipMove from "react-flip-move"
import { sortBy } from "lodash-es";
import HistoryItem from "./HistoryItem";

const getInitialState = () => ({
    reverting: null
});

/**
 * A list of HistoryItems associated with a single virusId.
 *
 * @class
 */
export default class VirusHistoryList extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        virus: React.PropTypes.string,
        history: React.PropTypes.array,
        canModify: React.PropTypes.bool
    };

    componentWillReceiveProps (nextProps) {
        if (nextProps.history.length < this.props.history.length) {
            this.setState(getInitialState());
        }
    }

    /**
     * Revert up to and including the passed version of the virus document. All history documents being reverted will
     * become disabled and display a spinner until they are removed from the collection.
     *
     * @param version {number} - the document version to revert past.
     * @func
     */
    revert = (version) => {
        this.setState({reverting: version}, () => {
            dispatcher.db.history.request("revert", {
                entry_id: this.props.virus,
                entry_version: version
            });
        });
    };

    render () {

        // Generate all the history components that will be shown in the history panel for the virus.
        const historyComponents = sortBy(this.props.history, "entry_version").reverse().map((historyEntry) => (
            <HistoryItem
                key={historyEntry._id}
                {...historyEntry}
                collection={dispatcher.db.history}
                pending={this.state.reverting !== null && historyEntry.entry_version >= this.state.reverting}
                onRevert={this.props.canModify ? this.revert: null}
            />
        ));

        return (
            <FlipMove typeName="div" className="list-group" fill={true} leaveAnimation={false} duration={200}>
                {historyComponents}
            </FlipMove>
        );
    }
}
