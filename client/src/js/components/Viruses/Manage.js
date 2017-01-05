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

import React from "react";

import Add from "./Manage/Add";
import Export from "./Manage/Export";
import Import from "./Manage/Import";
import VirusList from "./Manage/List";
import VirusToolbar from "./Manage/Toolbar";

/**
 * A main window component used for viewing all viruses in the reference database and adding new viruses via a modal
 * form.
 *
 * @class
 */
export default class ManageViruses extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            documents: dispatcher.db.viruses.chain(),

            findTerm: "",
            modifiedOnly: false,
            sortTerm: "name",
            sortDescending: false
        };
    }

    static propTypes = {
        route: React.PropTypes.object
    };

    componentDidMount () {
        dispatcher.db.viruses.on("change", this.update);
    }

    componentWillUnmount () {
        dispatcher.db.viruses.off("change", this.update);
    }

    setFindTerm = (event) => {
        this.setState({
            findTerm: event.target.value || ""
        });
    };

    toggleModifiedOnly = () => {
        this.setState({
            modifiedOnly: !this.state.modifiedOnly
        });
    };

    update = () => {
        this.setState({
            documents: dispatcher.db.viruses.chain()
        });
    };

    /**
     * Hides the virus detail modal. Triggered by called the onHide prop function within the modal.
     *
     * @func
     */
    hideModal = () => {
        dispatcher.router.clearExtra();
    };

    render () {

        let documents = this.state.documents.branch();

        if (this.state.modifiedOnly) {
            documents = documents.find({modified: true});
        }

        if (this.state.findTerm) {

            const findTermTest = {$regex: [this.state.findTerm, "i"]};

            documents = documents.find({$or: [
                {name: findTermTest},
                {abbreviation: findTermTest}
            ]});
        }

        documents = documents.simplesort(this.state.sortTerm).data();

        return (
            <div>
                <VirusToolbar
                    onChange={this.setFindTerm}
                    modifiedOnly={this.state.modifiedOnly}
                    toggleModifiedOnly={this.toggleModifiedOnly}
                />

                <VirusList
                    route={this.props.route}
                    documents={documents}
                    canArchive={this.state.canArchive}
                />

                <Add show={this.props.route.extra[0] === "add"} onHide={this.hideModal} />

                <Export show={this.props.route.extra[0] === "export"} onHide={this.hideModal} />

                <Import show={this.props.route.extra[0] === "import"} onHide={this.hideModal} />
            </div>
        );
    }
}
