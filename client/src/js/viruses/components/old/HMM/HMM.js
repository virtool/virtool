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
import { Icon, DetailModal, Flex, FlexItem, Button, AutoProgressBar } from "virtool/js/components/Base"
import { numberToWord } from "virtool/js/utils";

import HMMTable from "./HMM/Table";
import HMMDetail from "./HMM/Detail";
import HMMToolbar from "./HMM/Toolbar"
import ImportModal from "./HMM/Import";
import UploadModal from "./HMM/Upload";

const getHMMStatus = () => {
    return dispatcher.db.status.by("_id", "hmm");
};

const getDocuments = () => {
    return dispatcher.db.hmm.chain();
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
            documents: getDocuments(),
            status: getHMMStatus(),

            findTerm: "",
            sortKey: "cluster",
            sortDescending: false,
            pending: false
        };
    }

    static propTypes = {
        route: PropTypes.object
    };

    componentDidMount () {
        dispatcher.db.status.on("change", this.updateStatus);
        dispatcher.db.hmm.on("change", this.updateAnnotations)
    }

    componentWillUnmount () {
        dispatcher.db.status.off("change", this.updateStatus);
        dispatcher.db.hmm.off("change", this.updateAnnotations)
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
        window.router.clearExtra();
    };

    clean = () => {
        this.setState({pending: true}, () => {
            dispatcher.db.hmm.request("clean", {})
        });
    };

    updateStatus = () => {
        let state = {
            status: getHMMStatus()
        };

        if (state.status.not_in_file.length === 0) {
            state.pending = false;
        }

        this.setState(state);
    };

    updateAnnotations = () => {
        this.setState({
            documents: getDocuments()
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

        const annotationCount = this.state.documents.branch().count();

        let documents = this.state.documents.branch().find(query).simplesort(this.state.sortKey).data();

        if (this.state.sortDescending) {
            documents = documents.reverse();
        }

        let detailTarget;

        if (this.props.route.extra[0] === "detail") {
            detailTarget = dispatcher.db.hmm.findOne({_id: this.props.route.extra[1]});
        }

        let fileWarning;

        if (this.state.status.hmm_file) {
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
                    start using NuVs. {fileWarning ? null: "An HMM file has already been uploaded."}
                    <Icon
                        name="reset"
                        onClick={() => dispatcher.db.hmm.request("check")}
                        pullRight
                    />
                </Alert>
            );
        }

        let errors = [];

        if (this.state.status.not_in_database.length > 0 && !alert) {
            const value = this.state.status.not_in_database;

            errors.push(
                <Alert key="not_in_database" bsStyle="danger">
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

        if (this.state.status.not_in_file.length && !alert) {
            const value = this.state.status.not_in_file.length;

            errors.push(
                <Alert key="not_in_file" bsStyle="warning">
                    <AutoProgressBar
                        active={this.state.pending}
                        bsStyle="warning"
                        step={4}
                        interval={600}
                        affixed
                    />
                    <Flex>
                        <FlexItem>
                            <strong>
                                There {makeSpecifier(value.length, "annotation")} in the database for which no
                                profiles exist in the HMM file.
                            </strong>
                            &nbsp;
                            <span>
                                Repairing this problem will remove extra annotations from the database.
                            </span>
                        </FlexItem>

                        <FlexItem grow={0} shrink={0} pad={30}>
                            <Button icon="hammer" onClick={this.clean}>
                                Repair
                            </Button>
                        </FlexItem>
                    </Flex>
                </Alert>
            );
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
                    status={this.state.status}

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
                    annotationCount={annotationCount}
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
