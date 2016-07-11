/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ManageViruses
 */

'use strict';

var _ = require('lodash');
var React = require('react');

var Toolbar = require('./Manage/Toolbar/Toolbar.jsx');
var Detail = require('./Manage/Detail.jsx');
var Export = require('./Manage/Export.jsx');
var Import = require('./Manage/Import.jsx');
var Add = require('./Manage/Add.jsx');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var DynamicTable = require('virtool/js/components/Base/DynamicTable/DynamicTable.jsx');
var ConfirmModal = require('virtool/js/components/Base/ConfirmModal.jsx');
var ConfirmManagerMixin = require('virtool/js/components/Base/Mixins/ConfirmManagerMixin.js');
var DetailModal = require('virtool/js/components/Base/DetailModal.jsx');

/**
 * A main window component used for viewing all viruses in the reference database and adding new viruses via a modal
 * form.
 *
 * @class
 */
var ManageViruses = React.createClass({

    mixins: [ConfirmManagerMixin],

    openDetailModal: function (target) {
        dispatcher.router.setExtra(["detail", target._id]);
    },

    /**
     * Hides the virus detail modal. Triggered by called the onHide prop function within the modal.
     *
     * @func
     */
    hideModal: function () {
        dispatcher.router.clearExtra();
    },

    /**
     * An object describing the fields that should be rendered in the DynamicTable component.
     *
     * @object
     */
    fields: [
        {
            key: 'name',
            label: 'Virus Name',
            size: 5
        },
        {
            key: 'abbreviation',
            size: 3
        },
        {
            key: 'isolates',
            size: 2
        },
        {
            key: 'modified',
            size: 'fit',
            label: <Icon name='pencil' />,
            render: function (document) {
                return document.modified ? <div className='text-center'><Icon name='flag' bsStyle='warning' /></div>: null;
            }
        }

    ],

    render: function () {
        // Props used to construct the DynamicTable.
        var tableProps = {
            collection: dispatcher.collections.viruses,
            filterComponent: Toolbar,
            fields: this.fields,
            documentsNoun: 'viruses',
            onClick: this.openDetailModal,
            initialSortKey: 'name',
            initialSortDescending: false,
            alwaysShowFilter: true
        };

        var detailTarget;

        if (this.props.route.extra[0] === 'detail') {
            detailTarget = _.find(dispatcher.collections.viruses.documents, {_id: this.props.route.extra[1]});
        }

        return (
            <div>
                <DynamicTable {...tableProps} />

                <ConfirmModal {...this.confirmManager.getProps()} noun='sample' />

                <DetailModal
                    target={detailTarget}
                    onHide={this.hideModal}
                    contentComponent={Detail}
                    collection={dispatcher.collections.viruses}
                    settings={dispatcher.settings}
                />

                <Add show={this.props.route.extra[0] === "add"} onHide={this.hideModal} />

                <Export show={this.props.route.extra[0] === "export"} onHide={this.hideModal} />

                <Import show={this.props.route.extra[0] === "import"} onHide={this.hideModal} />
            </div>
        );
    }
});

module.exports = ManageViruses;