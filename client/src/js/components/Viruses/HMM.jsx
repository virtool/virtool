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


var Toolbar = require('./HMM/Toolbar.jsx');
var DynamicTable = require('virtool/js/components/Base/DynamicTable/DynamicTable.jsx');
var DetailModal = require('virtool/js/components/Base/DetailModal.jsx');

var HMMDetail = require('./HMM/Detail.jsx');
var ImportModal = require('./HMM/Import.jsx');
var FilesModal = require('./HMM/Files.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');

/**
 * A main component that shows a history of all index builds and the changes that comprised them.
 *
 * @class
 */
var HMM = React.createClass({

    showDetail: function (document) {
        dispatcher.router.setExtra(["detail", document._id]);
    },

    /**
     * Hides the virus detail modal. Triggered by called the onHide prop function within the modal.
     *
     * @func
     */
    hideModal: function () {
        dispatcher.router.clearExtra();
    },

    fields: [
        {
            key: 'cluster',
            size: 1
        },
        {
            key: 'label',
            size: 7,
            render: function (document) {
                return document.label;
            }
        },
        {
            key: 'families',
            size: 4,
            render: function (document) {
                var families = Object.keys(document.families);
                var ellipse = families.length > 3 ? "...": null;

                var labelComponents = families.slice(0, 3).map(function (family, index) {
                    return <span key={index}><Label>{family}</Label> </span>
                });

                return (
                    <span>
                        {labelComponents} {ellipse}
                    </span>
                );
            }
        }
    ],

    render: function () {

        var tableProps = {
            collection: dispatcher.db.hmm,
            filterComponent: Toolbar,
            fields: this.fields,
            documentsNoun: 'annotations',
            onClick: this.showDetail,
            initialSortKey: 'cluster',
            initialSortDescending: false,
            alwaysShowFilter: true
        };

        var detailTarget;

        if (this.props.route.extra[0] === 'detail') {
            detailTarget = dispatcher.db.hmm.findOne({_id: this.props.route.extra[1]});
        }

        return (
            <div>
                <DynamicTable {...tableProps} />

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
