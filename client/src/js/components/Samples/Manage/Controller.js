import React from "react";
import FlipMove from "react-flip-move";
import { intersection, map, xor, includes, assign } from "lodash";
import { FormGroup, InputGroup, FormControl, ButtonGroup } from "react-bootstrap";
import { Icon, Button, DetailModal } from "virtool/js/components/Base";
import CreateSample from "./Create/Create";

import SampleList from "./List";
import SampleSelector from "./Selector";
import SampleDetail from "./Detail/Body";
import QuickAnalyze from "./QuickAnalyze";

export default class SampleController extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            findTerm: "",
            selected: [],
            imported: false,
            analyzed: false,
            archived: false,
            canCreate: dispatcher.user.permissions.add_sample
        };
    }

    static propTypes = {
        route: React.PropTypes.object,
        documents: React.PropTypes.object
    };

    componentDidMount () {
        dispatcher.user.on("change", this.onUserChange);
        this.nameNode.focus();
    }

    componentWillReceiveProps (nextProps) {
        if (this.state.selected.length > 0) {
            this.setState({
                selected: intersection(this.state.selected, map(nextProps.documents, "_id"))
            });
        }
    }

    componentWillUnmount () {
        dispatcher.user.off("change", this.onUserChange);
    }

    setFindTerm = (event) => {
        this.setState({
            findTerm: event.target.value
        });
    };

    toggleFlag = (name) => {
        let state = {};
        state[name] = !this.state[name];
        this.setState(state);
    };

    select = (sampleIds) => {
        this.setState({
            selected: sampleIds
        });
    };

    toggleSelect = (sampleIds) => {
        this.setState({
            selected: xor(sampleIds.constructor === Array ? sampleIds: [sampleIds], this.state.selected)
        });
    };

    selectNone = () => {
        this.setState({
            selected: []
        });
    };

    create = () => {
        dispatcher.router.setExtra(["create"]);
    };

    hideModal = () => {
        dispatcher.router.clearExtra();
    };

    onUserChange = () => {
        this.setState({
            canCreate: dispatcher.user.permissions.add_sample
        });
    };

    render () {

        let documents = this.props.documents.branch().find({
            archived: this.state.archived
        });

        if (this.state.imported) {
            documents = documents.find({imported: true});
        }

        if (this.state.analyzed) {
            documents = documents.find({analyzed: true});
        }

        if (this.state.findTerm) {
            const test = {$regex: [this.state.findTerm, "i"]};

            documents = documents.find({$or: [
                {name: test},
                {username: test}
            ]});
        }

        documents = documents.simplesort("name").data();

        let toolbar;
        let selector;
        let selectedDocuments = [];

        if (this.state.selected.length === 0) {
            toolbar = (
                <div key="toolbar" className="toolbar">
                    <FormGroup>
                        <InputGroup>
                            <InputGroup.Addon>
                                <Icon name="search" /> Find
                            </InputGroup.Addon>
                            <FormControl
                                type="text"
                                inputRef={(node) => this.nameNode = node}
                                onChange={this.setFindTerm}
                                placeholder="Sample name"
                            />
                        </InputGroup>
                    </FormGroup>

                    <ButtonGroup>
                        <Button
                            tip="Show Active"
                            icon="play"
                            active={!this.state.archived}
                            onClick={this.state.archived ? () => this.toggleFlag("archived"): null}
                        />

                        <Button
                            tip="Show Archived"
                            icon="box-add"
                            active={this.state.archived}
                            onClick={this.state.archived ? null: () => this.toggleFlag("archived")}
                        />
                    </ButtonGroup>

                    <Button
                        tip="Show Imported"
                        icon="filing"
                        active={this.state.imported}
                        disabled={this.state.archived}
                        onClick={() => this.toggleFlag("imported")}
                    />

                    <Button
                        tip="Show Analyzed"
                        icon="bars"
                        active={this.state.analyzed}
                        disabled={this.state.archived}
                        onClick={() => this.toggleFlag("analyzed")}
                    />

                    <Button
                        icon="new-entry"
                        bsStyle="primary"
                        onClick={this.create}
                        disabled={this.state.archived}
                    >
                        Create
                    </Button>
                </div>
            );
        } else {

            documents = documents.map((document) => {
                const isSelected = includes(this.state.selected, document._id);

                if (isSelected) {
                    selectedDocuments.push(document)
                }

                return assign({selected: isSelected}, document);
            });

            selector = (
                <SampleSelector
                    key="selector"
                    archived={this.state.archived}
                    selected={selectedDocuments}
                    selectNone={this.selectNone}
                />
            );
        }

        let detailTarget;

        if (this.props.route.extra[0] === "detail") {
            detailTarget = dispatcher.db.samples.findOne({_id: this.props.route.extra[1]});
        }

        return (
            <div>
                <FlipMove typeName="div" duration={150} enterAnimation="fade" leaveAnimation={false}>
                    {toolbar}
                    {selector}

                    <div key="list">
                        <SampleList
                            route={this.props.route}
                            documents={documents}

                            select={this.select}
                            toggleSelect={this.toggleSelect}
                            selecting={this.state.selected.length > 0}
                        />
                    </div>
                </FlipMove>

                <CreateSample
                    show={this.props.route.extra[0] === "create"}
                    onHide={this.hideModal}
                />

                <QuickAnalyze
                    show={this.props.route.extra.length === 2 && this.props.route.extra[0] === "quick-analyze"}
                    sampleId={this.props.route.extra[1]}
                    onHide={this.hideModal}
                />

                <DetailModal
                    target={detailTarget}
                    onHide={this.hideModal}
                    contentComponent={SampleDetail}
                    collection={dispatcher.db.samples}
                />
            </div>
        );
    }
}
