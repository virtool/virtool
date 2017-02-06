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
import { isEqual } from "lodash";
import { Icon, Paginator, DetailModal, ListGroupItem, getFlipMoveProps } from "virtool/js/components/Base";

import VirusEntry from "./Entry";
import VirusDetail from "./Detail";

class VirusComponents extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            wait: false,
            documents: this.props.documents
        };
    }

    static propTypes = {
        page: React.PropTypes.number,
        documents: React.PropTypes.arrayOf(React.PropTypes.object)
    };

    componentWillReceiveProps (nextProps) {
        if (!this.state.wait || this.props.page != nextProps.page) {
            this.setState({documents: nextProps.documents});
        }
    }

    shouldComponentUpdate (nextProps, nextState) {
        return !isEqual(this.state.documents, nextState.documents);
    }

    handleStartAll = () => this.setState({wait: true});

    handleFinishAll = () => {
        this.setState({
            wait: false,
            documents: this.props.documents
        });
    };

    render () {

        let virusComponents;

        if (this.state.documents && this.state.documents.length > 0) {
            virusComponents = this.state.documents.map(document =>
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

        return (
            <FlipMove {...getFlipMoveProps()} onStartAll={this.handleStartAll} onFinishAll={this.handleFinishAll}>
                {virusComponents}
            </FlipMove>
        );
    }
}

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

    componentWillUnmount = () => this.hideModal();

    hideModal = () => dispatcher.router.clearExtra();

    render () {

        const pages = Paginator.calculatePages(this.props.documents, this.state.page, 15);

        let paginator;

        if (pages.count > 1) {
            paginator = (
                <Paginator
                    page={this.state.page}
                    count={pages.count}
                    onChange={(page) => this.setState({page: page})}
                />
            );
        }

        let detailTarget;

        if (this.props.route.extra[0] === "detail") {
            detailTarget = dispatcher.db.viruses.findOne({_id: this.props.route.extra[1]});
        }

        return (
            <div>
                <VirusComponents documents={pages.documents} page={this.state.page} />

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
