/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports HMM
 */

'use strict';

var React = require('react');
var Label = require('react-bootstrap/lib/Label');

var HMMTable = require('./HMM/Table.jsx');
var HMMDetail = require('./HMM/Detail.jsx');
var HMMToolbar = require('./HMM/Toolbar.jsx');
var ImportModal = require('./HMM/Import.jsx');
var FilesModal = require('./HMM/Files.jsx');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var DetailModal = require('virtool/js/components/Base/DetailModal.jsx');

/**
 * A main component that shows a history of all index builds and the changes that comprised them.
 *
 * @class
 */
var HMM = React.createClass({

    getInitialState: function () {
        return {
            findTerm: "",

            sortKey: "cluster",
            sortDescending: false
        }
    },

    setFindTerm: function (value) {
        this.setState({
            findTerm: value
        });
    },

    sort: function (key) {
        this.setState({
            sortKey: key,
            sortDescending: this.state.sortKey === key ? !this.state.sortDescending: false
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

        var query;

        if (this.state.findTerm) {
            var test = {$regex: [this.state.findTerm, "i"]};

            query = {
                $or: [
                    {cluster: test},
                    {label: test}
                ]
            };
        }

        var documents = dispatcher.db.hmm.chain().find(query).simplesort(this.state.sortKey).data();

        if (this.state.sortDescending) {
            documents = documents.reverse();
        }

        var detailTarget;

        if (this.props.route.extra[0] === 'detail') {
            detailTarget = dispatcher.db.hmm.findOne({_id: this.props.route.extra[1]});
        }




        return (
            <div>
                <HMMToolbar
                    findTerm={this.state.findTerm}
                    setFindTerm={this.setFindTerm}
                />

                <HMMTable
                    documents={documents}

                    sort={this.sort}
                    sortKey={this.state.sortKey}
                    sortDescending={this.state.sortDescending}
                />

                <ImportModal
                    show={this.props.route.extra[0] === "import"}
                    onHide={this.hideModal}
                />

                <FilesModal
                    show={this.props.route.extra[0] === "files"}
                    onHide={this.hideModal}
                />

                <DetailModal
                    target={detailTarget}
                    onHide={this.hideModal}
                    contentComponent={HMMDetail}
                    collection={dispatcher.db.hmm}
                    settings={dispatcher.settings}
                />
            </div>
        );
    }

});

module.exports = HMM;
