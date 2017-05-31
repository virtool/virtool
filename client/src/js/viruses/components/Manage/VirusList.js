/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports VirusList
 */

import React from "react";
import { Route } from "react-router-dom";
import { ListGroup } from "react-bootstrap";
import { Icon, ListGroupItem } from "virtool/js/components/Base";

import VirusEntry from "./Entry";
import VirusToolbar from "./Toolbar";
import CreateVirus from "./Create";

export default class VirusList extends React.Component {

    constructor (props) {
        super(props)
    }

    static propTypes = {
        documents: React.PropTypes.arrayOf(React.PropTypes.object),
        onFind: React.PropTypes.func
    };

    componentDidMount () {
        this.props.onFind(null);
    }

    render () {

        let virusComponents;

        if (this.props.documents && this.props.documents.length > 0) {
            virusComponents = this.props.documents.map(document =>
                <VirusEntry
                    key={document.virus_id}
                    {...document}
                />
            );
        } else {
            virusComponents = (
                <ListGroupItem key="noViruses" className="text-center">
                    <Icon name="info"/> No viruses found.
                </ListGroupItem>
            );
        }

        return (
            <div className="container">
                <VirusToolbar {...this.props} />

                <ListGroup>
                    {virusComponents}
                </ListGroup>

                <Route path="/viruses/create">
                    <CreateVirus {...this.props} />
                </Route>
            </div>
        );

    }
}
