/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ExportViruses
 */

import React from "react";
import { Modal, Panel } from "react-bootstrap";
import { Icon, Button } from "virtool/js/components/Base";
import { byteSize } from "virtool/js/utils";

const getInitialState = () => ({
    filename: "viruses.json",
    download: null,
    pending: false
});

/**
 * A component the contains child components that modify certain general options. A small explanation of each
 * subcomponent is also rendered.
 */
export default class ExportViruses extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        show: React.PropTypes.bool,
        onHide: React.PropTypes.func.isRequired
    };

    modalExited = () => {
        this.setState(getInitialState());
    };

    handleClick = () => {
        this.setState({download: false, pending: true}, () => {
            dispatcher.db.viruses.request("export").success((data) => {
                this.setState({
                    download: data,
                    pending: false
                });
            });
        });
    };

    render () {

        let button;

        const buttonProps = {
            block: true,
            bsStyle: "primary"
        };

        if (this.state.download) {
            const link = `download/${this.state.download.filename}`;

            button = (
                <Button href={link} download="viruses.json.gz" {...buttonProps}>
                    <Icon name="arrow-down" /> Download ({byteSize(this.state.download.size)})
                </Button>
            );
        } else {
            button = (
                <Button {...buttonProps} onClick={this.handleClick} disabled={this.state.pending}>
                    <Icon name="export" pending={this.state.pending} /> Export
                </Button>
            );
        }

        return (
            <Modal show={this.props.show} onHide={this.props.onHide} onExited={this.modalExited}>

                <Modal.Header onHide={this.props.onHide} closeButton>
                    Export Viruses
                </Modal.Header>

                <Modal.Body>
                    <Panel>
                        Export all viruses as they exist in the most recent index build. The generated JSON file can
                        be imported into a new Virtool instance. History will not be preserved.
                    </Panel>

                    {button}
                </Modal.Body>

            </Modal>
        );



    }
}
