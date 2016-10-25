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

'use strict';

var _ = require('lodash');
var React = require('react');
var FlipMove = require('react-flip-move');
var Label = require('react-bootstrap/lib/Label');
var Table = require('react-bootstrap/lib/Table');

var HMMEntry = require('./Entry.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');
var Paginator = require('virtool/js/components/Base/Paginator.jsx');
var DetailModal = require('virtool/js/components/Base/DetailModal.jsx');


var CaretHeader = React.createClass({

    propTypes: {
        name: React.PropTypes.string,
        onClick: React.PropTypes.func,
        showCaret: React.PropTypes.bool,
        descending: React.PropTypes.bool
    },

    /**
     * Calls the onSort prop function and passed the fieldKey associated with this component. Triggered by clicking the
     * column header.
     *
     * @func
     */
    sort: function () {
        this.props.onClick(this.props.name);
    },

    render: function () {

        var caret;

        if (this.props.showCaret) {
            caret = (
                <Flex.Item pad={5}>
                    <Icon name={'caret-' + (this.props.descending ? 'up': 'down')} />
                </Flex.Item>
            );
        }

        return (
            <div className="pointer" onClick={this.sort}>
                <Flex>
                    <Flex.Item>
                        {_.capitalize(this.props.name)}
                    </Flex.Item>
                    {caret}
                </Flex>
            </div>
        );
    }

});

/**
 * A main component that shows a history of all index builds and the changes that comprised them.
 *
 * @class
 */
var HMMTable = React.createClass({

    getInitialState: function () {
        return {
            page: 1
        };
    },

    setPage: function (page) {
        this.setState({
            page: page
        });
    },

    /**
     * Hides the virus detail modal. Triggered by called the onHide prop function within the modal.
     *
     * @func
     */
    hideModal: function () {
        dispatcher.router.clearExtra();
    },

    render: function () {

        var pages = Paginator.calculatePages(this.props.documents, this.state.page);

        var rowComponents = pages.documents.map(function (document) {
            return (
                <HMMEntry
                    key={document._id}
                    _id={document._id}
                    cluster={document.cluster}
                    label={document.label}
                    families={document.families}
                />
            );
        });

        var caretProps = {
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

                    <FlipMove typeName="tbody" enterAnimation="accordianHorizontal" leaveAnimation={false} duration={150}>
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

});

module.exports = HMMTable;
