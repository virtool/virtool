/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports HistoryPager
 */

import React from "react";
import FlipMove from "react-flip-move"
import { Panel, Pagination } from "react-bootstrap";
import { Icon, getFlipMoveProps } from "virtool/js/components/Base";
import Virus from"./Virus";

/**
 * A component that shows the history of changes made to viruses in the database.
 *
 * @class
 */
export default class HistoryPager extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            page: 1,
            canModify: dispatcher.user.permissions.modify_virus
        }
    }

    static propTypes = {
        documents: React.PropTypes.arrayOf(React.PropTypes.object),
        perPage: React.PropTypes.number
    };

    static defaultProps = {
        perPage: 20
    };

    componentDidMount () {
        dispatcher.user.on("change", this.onUserChange);
    }

    componentWillUnmount () {
        dispatcher.user.on("change", this.onUserChange);
    }

    onUserChange = () => {
        const modifyVirus = dispatcher.user.permissions.modify_virus;

        if (this.state.canModify !== modifyVirus) {
            this.setState({
                canModify: dispatcher.user.permissions.modify_virus
            });
        }
    };

    handleSelect = (event, selectedEvent) => {
        this.setState({
            page: selectedEvent.eventKey
        });
    };

    render () {

        const panelStyle = {
            marginBottom: "5px"
        };

        // Get a rough number of pages.
        const roughPageCount = this.props.documents.length / this.props.perPage;

        // If pageCount is less than 1, set pageCount to 1 otherwise round the pageCount to the nearest whole number.
        const pageCount = roughPageCount >= 1 ? Math.ceil(roughPageCount): 1;

        // Determine the indexes of the slice of documents that should be taken to generate the page.
        const endIndex = this.state.page * this.props.perPage;
        const startIndex = endIndex - this.props.perPage;

        let content;

        const virusComponents = this.props.documents.slice(startIndex, endIndex).map((virusGroup, index) => {
            const header = <h5 className="pointer">{virusGroup.virusName} <small> {virusGroup.virusId}</small></h5>;

            return (
                <Panel key={virusGroup.virusId} eventKey={index} header={header} style={panelStyle} collapsible>
                    <Virus
                        history={virusGroup.history}
                        virus={virusGroup.virusId}
                        method={this.methods}
                        canModify={this.state.canModify}
                    />
                </Panel>
            );
        });

        if (virusComponents.length === 0) {
            // Show an info message if there are no changed viruses.
            content = (
                <Panel>
                    <div className="text-center"><Icon name="info" /> No changes found.</div>
                </Panel>
            );
        } else {
            const paginator = pageCount < 2 ? null: (
                <div className="text-center">
                    <Pagination
                        onSelect={this.handleSelect}
                        activePage={this.state.page}
                        items={pageCount}
                        maxButtons={10}
                        first
                        last
                        next
                        prev
                    />
                </div>
            );

            // Render panels with list groups of history items.
            content = (
                <div>
                    <FlipMove {...getFlipMoveProps()}>
                        {virusComponents}
                    </FlipMove>

                    {paginator}
                </div>
            );
        }

        return (
            <div>
                {content}
            </div>
        );
    }
}
