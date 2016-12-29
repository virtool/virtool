/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports HMMTable
 */

import { capitalize } from "lodash-es";
import React from "react";
import FlipMove from "react-flip-move"
import { Table } from "react-bootstrap";
import { Icon, Flex, Paginator } from "virtool/js/components/Base";

import HMMEntry from "./Entry";

export class CaretHeader extends React.Component {

    static propTypes = {
        name: React.PropTypes.string,
        onClick: React.PropTypes.func,
        showCaret: React.PropTypes.bool,
        descending: React.PropTypes.bool
    };

    sort = () => {
        this.props.onClick(this.props.name);
    };

    render () {

        let caret;

        if (this.props.showCaret) {
            caret = (
                <Flex.Item pad={5}>
                    <Icon name={"caret-" + (this.props.descending ? "up": "down")} />1
                </Flex.Item>
            );
        }

        return (
            <div className="pointer" onClick={this.sort}>
                <Flex>
                    <Flex.Item>
                        {capitalize(this.props.name)}
                    </Flex.Item>
                    {caret}
                </Flex>
            </div>
        );
    }
}

/**
 * A main component that shows a history of all index builds and the changes that comprised them.
 *
 * @class
 */
export default class HMMTable extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            page: 1
        };
    }

    static propTypes = {
        documents: React.PropTypes.arrayOf(React.PropTypes.object),
        sort: React.PropTypes.func,
        sortKey: React.PropTypes.string,
        sortDescending: React.PropTypes.bool
    };

    setPage = (page) => {
        this.setState({
            page: page
        });
    };

    hideModal = () => {
        dispatcher.router.clearExtra();
    };

    render () {

        const pages = Paginator.calculatePages(this.props.documents, this.state.page);

        const rowComponents = pages.documents.map(document => (
            <HMMEntry
                key={document._id}
                _id={document._id}
                cluster={document.cluster}
                label={document.label}
                families={document.families}
            />
        ));

        const caretProps = {
            onClick: this.props.sort,
            descending: this.props.sortDescending
        };

        return (
            <div>
                <Table hover>
                    <thead>
                        <tr>
                            <th className="col-md-1">
                                <CaretHeader
                                    name="cluster"
                                    showCaret={this.props.sortKey === "cluster"}
                                    {...caretProps}
                                />
                            </th>
                            <th className="col-md-7">
                                <CaretHeader
                                    name="label"
                                    showCaret={this.props.sortKey === "label"}
                                    {...caretProps}
                                />
                            </th>
                            <th className="col-md-4">
                                <CaretHeader
                                    name="families"
                                    showCaret={this.props.sortKey === "families"}
                                    {...caretProps}
                                />
                            </th>
                        </tr>
                    </thead>

                    <FlipMove
                        typeName="tbody"
                        enterAnimation="accordianHorizontal"
                        leaveAnimation={false}
                        duration={150}
                    >
                        {rowComponents}
                    </FlipMove>
                </Table>

                <Paginator
                    page={this.state.page}
                    count={pages.count}
                    onChange={this.setPage}
                />
            </div>
        );
    }
}
