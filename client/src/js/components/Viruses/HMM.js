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

import React from "react";
import { DetailModal } from "virtool/js/components/Base"

import HMMTable from "./HMM/Table";
import HMMDetail from "./HMM/Detail";
import HMMToolbar from "./HMM/Toolbar"
import ImportModal from "./HMM/Import";
import FilesModal from "./HMM/Files";

/**
 * A main component that shows a history of all index builds and the changes that comprised them.
 *
 * @class
 */
export default class HMM extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            findTerm: "",

            sortKey: "cluster",
            sortDescending: false
        };
    }

    static propTypes = {
        route: React.PropTypes.object
    };

    setFindTerm = (value) => {
        this.setState({
            findTerm: value
        });
    };

    sort = (key) => {
        this.setState({
            sortKey: key,
            sortDescending: this.state.sortKey === key ? !this.state.sortDescending: false
        });
    };

    hideModal = () => {
        dispatcher.router.clearExtra();
    };

    render () {

        let query;

        if (this.state.findTerm) {
            query = {
                $or: [
                    {cluster: Number(this.state.findTerm)},
                    {label: {
                        $regex: [this.state.findTerm, "i"]
                    }}
                ]
            };
        }

        let documents = dispatcher.db.hmm.chain().find(query).simplesort(this.state.sortKey).data();

        if (this.state.sortDescending) {
            documents = documents.reverse();
        }

        let detailTarget;

        if (this.props.route.extra[0] === "detail") {
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

}
