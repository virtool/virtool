/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports QuickAnalyze
 *
 */


import React from "react";
import { Modal } from "react-bootstrap";
import {
    AlgorithmSelect,
    Flex,
    FlexItem,
    Icon,
    Input,
    Checkbox,
    Button,
    AutoProgressBar
} from "virtool/js/components/Base";

const getInitialState = () => ({
    name: "",
    algorithm: dispatcher.user.settings.quick_analyze_algorithm || "pathoscope_bowtie",

    useAsDefault: false,
    skipQuickAnalyzeDialog: false,

    pending: false
});

/**
 * A main view for importing samples from FASTQ files. Importing starts an import job on the server.
 *
 * @class
 */
export default class QuickAnalyze extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        show: React.PropTypes.bool.isRequired,
        onHide: React.PropTypes.func.isRequired
    };

    modalWillEnter = () => {
        this.nameNode.focus();
    };

    modalExited = () => {
        this.setState(getInitialState());
    };

    handleChange = (event) => {
        let state = {};
        state[event.target.name] = event.target.value;
        this.setState(state);
    };

    handleSubmit = (event) => {
        event.preventDefault();

        this.setState({pending: true}, () => {
            dispatcher.db.samples.request("analyze", {
                samples: [window.router.route.extra[1]],
                algorithm: this.state.algorithm,
                name: this.state.name || null
            }).success(() => {

                if (this.state.useAsDefault) {
                    dispatcher.db.users.request("change_user_setting", {
                        key: "quick_analyze_algorithm",
                        value: this.state.algorithm
                    });
                }

                if (this.state.skipQuickAnalyzeDialog) {
                    dispatcher.db.users.request("change_user_setting", {
                        key: "skip_quick_analyze_dialog",
                        value: true
                    });
                }

                this.props.onHide();

            });
        });
    };

    toggleUseAsDefault = () => {
        this.setState({
            useAsDefault: !this.state.useAsDefault
        });
    };

    toggleSkipQuickAnalyzeDialog = () => {
        this.setState({
            skipQuickAnalyzeDialog: !this.state.skipQuickAnalyzeDialog
        });
    };

    render () {

        const sampleName = dispatcher.db.samples.by("_id", window.router.route.extra[1]).name;

        const checkboxProps = {
            className: "pointer",
            style: {
                paddingLeft: "1px",
                paddingTop: "10px"
            }
        };

        return (
            <Modal
                bsSize="small"
                show={this.props.show}
                onHide={this.props.onHide}
                onEnter={this.modalWillEnter}
                onExited={this.modalExited}
            >
                <form onSubmit={this.handleSubmit}>
                    <Modal.Header onHide={this.props.onHide} closeButton>
                        Quick Analyze
                    </Modal.Header>

                    <AutoProgressBar active={this.state.pending} affixed />

                    <Modal.Body>
                        <Input
                            label="Sample"
                            value={sampleName}
                            readOnly={true}
                        />

                        <Input
                            ref={(node) => this.nameNode = node}
                            name="name"
                            label="Analysis Name"
                            value={this.state.name}
                            onChange={this.handleChange}
                            disabled={true}
                        />

                        <AlgorithmSelect value={this.state.algorithm} onChange={this.handleChange} />

                        <div onClick={this.toggleUseAsDefault} {...checkboxProps}>
                            <Flex>
                                <FlexItem>
                                    <Checkbox
                                        checked={this.state.useAsDefault || this.state.skipQuickAnalyzeDialog}
                                    />
                                </FlexItem>
                                <FlexItem pad={7}>
                                    Set as default algorithm
                                </FlexItem>
                            </Flex>
                        </div>

                        <div onClick={this.toggleSkipQuickAnalyzeDialog} {...checkboxProps}>
                            <Flex>
                                <FlexItem>
                                    <Checkbox checked={this.state.skipQuickAnalyzeDialog}  />
                                </FlexItem>
                                <FlexItem pad={7}>
                                    Skip this dialog from now on
                                </FlexItem>
                            </Flex>
                        </div>
                    </Modal.Body>

                    <Modal.Footer>
                        <Button type="submit" bsStyle="primary">
                            <Icon name="new-entry" /> Create
                        </Button>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}
