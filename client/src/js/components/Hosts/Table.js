/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports HostsTable
 */

import React from "react";
import { sortBy } from "lodash";
import { Panel, ListGroup, ListGroupItem } from "react-bootstrap";
import { Icon } from "virtool/js/components/Base";

import HostEntry from "./Entry";

/**
 * A table describing all available and importing host references.
 *
 * @class
 */
export default class HostsTable extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            documents: sortBy(dispatcher.db.hosts.find(), "_id"),
            detailTarget: null
        };
    }

    componentDidMount () {
        dispatcher.db.hosts.on("change", this.update);
    }

    componentWillUnmount () {
        dispatcher.db.hosts.off("change", this.update);
    }

    /**
     * Show the details for the document described by the passed target object. Called when the modal is shown by
     * clicking a host document.
     *
     * @param target {object} - an object (partial document) describing the document to fetch detail for.
     * @func
     */
    showModal = (target) => {
        dispatcher.router.setExtra(["detail", target._id]);
    };

    /**
     * Update state to reflect changes in host collection documents. Triggered by an update event in the collection.
     *
     * @func
     */
    update = () => {
        this.setState({
            documents: sortBy(dispatcher.db.hosts.find(), "_id")
        });
    };

    render () {
        // The component to show in the table area. Will be either a table or a panel saying that there are no hosts.\
        let listContent;

        if (this.state.documents.length > 0) {
            listContent = this.state.documents.map((document) => (
                <HostEntry
                    {...document}
                    key={document._id}
                    showModal={this.showModal}
                />
            ));
        } else {
            listContent = (
                <ListGroupItem className="text-center">
                    <Icon name="notification" /> No hosts added.
                </ListGroupItem>
            );
        }

        return (
            <div>
                <Panel header="Hosts">
                    <ListGroup fill>
                        {listContent}
                    </ListGroup>
                </Panel>
            </div>
        )
    }
}
