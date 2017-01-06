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
import FlipMove from "react-flip-move"
import { Icon, Paginator, DetailModal, ListGroupItem } from "virtool/js/components/Base";

import VirusEntry from "./Entry";
import VirusDetail from "./Detail";

/**
 * A React component that is a simple composition of JobsTable. Applies a baseFilter that includes only active jobs.
 *
 * @class
 */
export default class VirusList extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            page: 1
        };
    }

    static propTypes = {
        route: React.PropTypes.object.isRequired,
        documents: React.PropTypes.arrayOf(React.PropTypes.object)
    };

    componentWillUnmount () {
        this.hideModal();
    }

    setPage = (page) => {
        this.setState({
            page: page
        });
    };

    hideModal = () => {
        dispatcher.router.clearExtra();
    };

    render () {

        const pages = Paginator.calculatePages(this.props.documents, this.state.page, 18);

        let virusComponents;

        if (pages.documents && pages.documents.length > 0) {
            virusComponents = pages.documents.map(document =>
                <VirusEntry
                    key={document._id}
                    {...document}
                />
            );
        } else {
            virusComponents = (
                <ListGroupItem key="noViruses" className="text-center">
                    <Icon name="info" /> No viruses found.
                </ListGroupItem>
            );
        }

        let paginator;

        if (pages.count > 1) {
            paginator = (
                <Paginator
                    page={this.state.page}
                    count={pages.count}
                    onChange={this.setPage}
                />
            );
        }

        let detailTarget;

        if (this.props.route.extra[0] === "detail") {
            detailTarget = dispatcher.db.viruses.findOne({_id: this.props.route.extra[1]});
        }

        return (
            <div>
                <FlipMove typeName="div" className="list-group" leaveAnimation={false}>
                    {virusComponents}
                </FlipMove>

                {paginator}

                <DetailModal
                    target={detailTarget}
                    onHide={this.hideModal}
                    contentComponent={VirusDetail}
                    collection={dispatcher.db.viruses}
                />
            </div>
        );
    }
}
