/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SamplesList
 */

import React from "react";
import FlipMove from "react-flip-move"
import { Icon, Paginator, ListGroupItem, getFlipMoveProps } from "virtool/js/components/Base";

import SampleEntry from "./Entry";

/**
 * A component based on DynamicTable that displays sample documents and allows them to be removed, archived, and viewed
 * in detail in a modal.
 *
 * @class
 */
export default class SamplesList extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            page: 1
        };
    }

    static propTypes = {
        documents: React.PropTypes.arrayOf(React.PropTypes.object),
        selecting: React.PropTypes.bool,
        toggleSelect: React.PropTypes.func,
        quickAnalyze: React.PropTypes.func
    };

    setPage = (page) => {
        this.setState({
            page: page
        });
    };

    archive = (targets) => {
        dispatcher.db.samples.request("archive", {_id: targets.map(target => target["_id"])});
    };

    render () {

        const pages = Paginator.calculatePages(this.props.documents, this.state.page, 18);

        let sampleComponents;

        if (pages.documents.length === 0) {
            sampleComponents = (
                <ListGroupItem key="noSample" className="text-center">
                    <Icon name="info" /> No samples found.
                </ListGroupItem>
            );
        } else {
            sampleComponents = pages.documents.map((document) =>
                <SampleEntry
                    key={document._id}
                    {...document}
                    selecting={this.props.selecting}
                    toggleSelect={this.props.toggleSelect}
                    quickAnalyze={this.props.quickAnalyze}
                />
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

        return (
            <div>
                <FlipMove {...getFlipMoveProps()}>
                    {sampleComponents}
                </FlipMove>

                {paginator}
            </div>
        );
    }
}
