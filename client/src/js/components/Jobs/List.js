/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports JobList
 */

import React from "react";
import FlipMove from "react-flip-move";
import { ListGroupItem } from "react-bootstrap";
import { Icon, DetailModal, getFlipMoveProps } from "virtool/js/components/Base";

import JobEntry from "./Entry";
import JobDetail from "./Detail/Detail";

export default class JobList extends React.Component {

    static propTypes = {
        route: React.PropTypes.object.isRequired,
        documents: React.PropTypes.arrayOf(React.PropTypes.object),

        canCancel: React.PropTypes.bool,
        canRemove: React.PropTypes.bool
    };

    componentWillUnmount () {
        this.hideModal();
    }

    hideModal = () => {
        window.router.clearExtra();
    };

    render () {

        let jobComponents;

        if (this.props.documents && this.props.documents.length > 0) {
            jobComponents = this.props.documents.map((document) => (
                <JobEntry
                    key={document._id}
                    canCancel={this.props.canCancel}
                    canRemove={this.props.canRemove}
                    {...document}
                />
            ));
        } else {
            jobComponents = (
                <ListGroupItem className="text-center">
                    <Icon name="info" /> No jobs found.
                </ListGroupItem>
            )
        }

        const detailTarget = dispatcher.db.jobs.findOne({_id: this.props.route.extra[1]});

        return (
            <div>
                <FlipMove {...getFlipMoveProps()}>
                    {jobComponents}
                </FlipMove>

                <DetailModal
                    target={detailTarget}
                    onHide={this.hideModal}
                    contentComponent={JobDetail}
                    collection={dispatcher.db.jobs}
                />
            </div>
        );
    }
}
