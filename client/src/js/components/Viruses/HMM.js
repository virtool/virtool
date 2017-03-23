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
import { Alert } from "react-bootstrap";
import { Icon, DetailModal } from "virtool/js/components/Base"
import { numberToWord } from "virtool/js/utils";

import HMMTable from "./HMM/Table";
import HMMDetail from "./HMM/Detail";
import HMMToolbar from "./HMM/Toolbar"
import ImportModal from "./HMM/Import";
import FilesModal from "./HMM/Files";
import UploadModal from "./HMM/Upload";

const getHMMStatus = () => {
    return dispatcher.db.status.by("_id", "hmm");
};

const makeSpecifier = (value, noun) => {
    return [(value === 1 ? "is": "are"), numberToWord(value), noun + (value === 1 ? "": "s")].join(" ")
};

/**
 * A main component that shows a history of all index builds and the changes that comprised them.
 *
 * @class
 */
export default class ManageHMM extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            findTerm: "",
            hmmStatus: getHMMStatus(),

            sortKey: "cluster",
            sortDescending: false
        };
    }

    static propTypes = {
        route: React.PropTypes.object
    };

    componentDidMount () {
        dispatcher.db.status.on("change", this.update);
    }

    componentWillUnmount () {
        dispatcher.db.status.off("change", this.update);
    }

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

    checkFiles = () => {
        dispatcher.db.hmm.request("check_files", {});
    };

    update = () => {
        this.setState({
            hmmStatus: getHMMStatus()
        });
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

        let fileWarning;

        if (this.state.hmmStatus.errors.hmm_file) {
            fileWarning = <a href="#viruses/hmm/upload" className="pointer alert-link">Upload an HMM file</a>;
        }

        let annotationWarning;

        if (documents.length === 0) {
            annotationWarning = (
                <a href="#viruses/hmm/import" className="pointer alert-link">
                    {fileWarning ? "import": "Import"} annotations
                </a>
            );
        }

        let alert;

        if (fileWarning || annotationWarning) {
            alert = (
                <Alert bsStyle="warning">
                    <Icon name="warning" />
                    <span> {fileWarning} {fileWarning && annotationWarning ? "and": null} {annotationWarning}</span> to
                    start using NuVs.
                    <Icon name="reset" onClick={this.checkFiles} pullRight />
                </Alert>
            );
        }

        let errors = [];

        if (this.state.hmmStatus.errors.not_in_database.length > 0 && !alert) {
            const value = this.state.hmmStatus.errors.not_in_database;

            errors.push(
                <Alert bsStyle="danger">
                    <strong>
                        There {makeSpecifier(value.length, "profile")} in <code>profiles.hmm</code> that do not have
                        annotations in the database.
                    </strong>
                    &nbsp;
                    <span>
                        Ensure the annotation database and HMM file match by importing annotations or uploading a new
                        HMM file
                    </span>
                </Alert>
            )
        }

        return (
            <div>
                {alert}

                {errors}

                <HMMToolbar
                    findTerm={this.state.findTerm}
                    setFindTerm={this.setFindTerm}
                />

                <HMMTable
                    documents={documents}
                    hmmStatus={this.state.hmmStatus}

                    sort={this.sort}
                    sortKey={this.state.sortKey}
                    sortDescending={this.state.sortDescending}
                />

                <UploadModal
                    show={this.props.route.extra[0] === "upload"}
                    onHide={this.hideModal}
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
