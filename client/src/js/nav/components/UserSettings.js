/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports UserSettings
 */

import React from "react";
import { assign } from "lodash";
import { Panel, Modal } from "react-bootstrap";
import { AlgorithmSelect, Flex, FlexItem, Checkbox, ProgressBar,  } from "../../base";

export default class UserSettings extends React.Component {

    constructor (props) {
        super(props);

        this.state = assign({pending: false}, dispatcher.user.settings);
    }

    static propTypes = {
        user: PropTypes.object,
        show: PropTypes.bool.isRequired,
        onHide: PropTypes.func.isRequired
    };

    requestSet = (key, value) => {
        this.setState({pending: true}, () => {
            dispatcher.db.users.request("change_user_setting", {
                key: key,
                value: value
            }).success(() => this.setState({pending: false}));
        });
    };

    toggleSetting = (key) => {
        this.requestSet(key, !this.props.user.settings[key]);
    };

    update = () => {
        this.setState(assign({pending: false}, dispatcher.user.settings));
    };

    toggleShowIds = () => {
        this.toggleSetting("show_ids")
    };

    toggleShowVersions = () => {
        this.toggleSetting("show_versions")
    };

    toggleSkipQuickAnalyzeDialog = () => {
        this.toggleSetting("skip_quick_analyze_dialog");
    };

    setQuickAnalyzeAlgorithm = (event) => {
        this.requestSet("quick_analyze_algorithm", event.target.value);
    };

    render () {

        const checkboxProps = {
            style: {
                marginBottom: "10px"
            },

            className: "pointer"
        };

        return (
            <Modal bsSize="small" show={this.props.show} onHide={this.props.onHide}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    User Settings
                </Modal.Header>

                <ProgressBar active={this.state.pending} affixed />

                <Modal.Body>
                    <Panel header="Display">
                        <div onClick={this.toggleShowIds}>
                            <Flex {...checkboxProps}>
                                <FlexItem>
                                    <Checkbox checked={this.props.user.settings.show_ids} />
                                </FlexItem>
                                <FlexItem pad={7}>
                                    Show database IDs
                                </FlexItem>
                            </Flex>
                        </div>

                        <div onClick={this.toggleShowVersions}>
                            <Flex {...checkboxProps}>
                                <FlexItem>
                                    <Checkbox checked={this.props.user.settings.show_versions} />
                                </FlexItem>
                                <FlexItem pad={7}>
                                    Show database versions
                                </FlexItem>
                            </Flex>
                        </div>
                    </Panel>

                    <Panel header="Quick Analyze">
                        <div onClick={this.toggleSkipQuickAnalyzeDialog}>
                            <Flex {...checkboxProps}>
                                <FlexItem>
                                    <Checkbox checked={this.props.user.settings.skip_quick_analyze_dialog} />
                                </FlexItem>
                                <FlexItem pad={7}>
                                    Skip quick analyze dialog
                                </FlexItem>
                            </Flex>
                        </div>

                        <AlgorithmSelect
                            value={this.props.user.settings.quick_analyze_algorithm}
                            onChange={this.setQuickAnalyzeAlgorithm}
                        />
                    </Panel>
                </Modal.Body>
            </Modal>
        );
    }
}
