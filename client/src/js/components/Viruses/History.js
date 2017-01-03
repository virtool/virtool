/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports VirusHistory
 */

import React from "react";
import { isEqual, uniq, pull, groupBy, transform, sortBy } from "lodash-es";

import HistoryControl from "./History/Control";
import HistoryPager from "./History/Pager";

/**
 * A component that shows the history of changes made to viruses in the database.
 *
 * @class
 */
export default class VirusHistory extends React.Component {

    constructor (props) {
        super(props);

        let indexVersion = this.props.route.extra[0] || "unbuilt";

        if (indexVersion !== "unbuilt") {
            indexVersion = Number(indexVersion);
        }

        this.state = {
            filter: "",
            documents: dispatcher.db.history.chain().find({index_version: indexVersion})
        };
    }

    static propTypes = {
        route: React.PropTypes.object
    };

    componentDidMount () {
        dispatcher.db.history.on("change", this.update);
    }

    componentWillReceiveProps (nextProps) {
        if (!isEqual(this.props.route, nextProps.route)) {
            this.update(null, nextProps.route);
        }
    }

    componentWillUnmount () {
        dispatcher.db.history.off("change", this.update);
    }

    /**
     * Apply a virus name filter to the history documents. Called when the value of the filter input element changes.
     *
     * @param event {object} - the change event use to get the new input value.
     * @func
     */
    filter = (event) => {
        this.setState({
            filter: event.target.value || null
        });
    };

    update = (event, route = this.props.route) => {

        let indexVersion = route.extra[0] || "unbuilt";

        if (indexVersion !== "unbuilt") {
            indexVersion = Number(route.extra[0]);
        }

        this.setState({
            documents: dispatcher.db.history.chain().find({index_version: indexVersion})
        })
    };

    render () {

        // Get all of the different index versions from the history documents.
        let indexVersions = uniq(dispatcher.db.history.extract("index_version"));

        pull(indexVersions, "unbuilt");

        // Get rid of duplicate index versions, sort numerically and reverse the order.
        indexVersions = indexVersions.sort((a, b) => a - b);

        // Add the "unbuilt" version number which will show unbuilt changes when selected.
        indexVersions.push("unbuilt");

        indexVersions.reverse();

        let indexVersion = this.props.route.extra[0];

        if (indexVersion === undefined) {
            indexVersion = "unbuilt";
        }

        if (indexVersion !== "unbuilt") {
            indexVersion = Number(indexVersion);
        }

        let documents = this.state.documents.copy();

        if (this.state.filter) {
            documents.find({
                virus: {
                    "$regex": [this.state.filter, "i"]
                }
            });
        }

        documents = documents.data();

        // Group the history documents by virus_id. The history documents will be grouped into virus-specific panels.
        const grouped = groupBy(documents, document => document.entry_id);

        // Sort the grouped history by ascending virus name.
        let sorted = transform(grouped, (result, history, virusId) => {

            const sortedHistory = sortBy(history, "document_version").reverse();

            result.push({
                virusId: virusId,
                virusName: sortedHistory[0].virus,
                history: sortedHistory
            });

        }, []);

        sorted = sortBy(sorted, "virusName");

        return (
            <div>
                <HistoryControl
                    onFilter={this.filter}
                    onSelectIndex={this.selectIndex}
                    indexVersions={indexVersions}
                    selectedVersion={indexVersion}
                />

                <HistoryPager documents={sorted} />
            </div>
        )
    }
}
