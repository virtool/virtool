/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports HostFiles
 */

import React from "react";
import { Panel, ListGroup } from "react-bootstrap";
import { Icon, ListGroupItem } from "virtool/js/components/Base"

import HostFasta from "./Fasta";

function getHostFiles () {
    return dispatcher.db.files.chain().find({"file_type": "host_fasta"}).branch()
}

export default class HostFiles extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            documents: getHostFiles()
        };
    }

    componentDidMount () {
        // Listen for updates to the host files collection. Also tell the server to listen for changes in the files
        // directory and update the collection with any changes.
        dispatcher.db.files.on("change", this.update);
    }

    componentWillUnmount () {
        // Stop listening for changes to the collection and tell the server that we don"t want to watch for changes to
        // the host files anymore.
        dispatcher.db.files.off("change", this.update);
    }

    /**
     * Update the host file documents based on the files collection.
     *
     * @func
     */
    update = () => {
        this.setState(getHostFiles());
    };

    render () {
        
        // The files documents.
        let listComponents = this.state.documents.data().map((file) => (
            <HostFasta
                key={file._id}
                add={this.add}
                {...file}
            />
        ));

        if (listComponents.length === 0) {
            listComponents = (
                <ListGroupItem className="text-center">
                    <Icon name="notification" /> No files found.
                </ListGroupItem>
            );
        }

        return (
            <div>
                <Panel header="Available Files">
                    <ListGroup fill>
                        {listComponents}
                    </ListGroup>
                </Panel>
            </div>
        )
    }
}
