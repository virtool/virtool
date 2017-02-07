/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ImportVirusesProgress
 */

import React from "react";
import { capitalize } from "lodash";
import { Alert, ListGroup } from "react-bootstrap";
import { ListGroupItem, Icon, Flex, FlexItem, ProgressBar } from "virtool/js/components/Base";
import { byteSize } from "virtool/js/utils";

const getInitialState = () => ({
    progress: 0,
    added: 0,
    replaced: 0,
    skipped: 0,
    warnings: []
});

/**
 * A component the contains child components that modify certain general options. A small explanation of each
 * subcomponent is also rendered.
 */
export default class ImportVirusesProgress extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        fileId: React.PropTypes.string.isRequired,
        fileDocument: React.PropTypes.object.isRequired,
        replace: React.PropTypes.bool.isRequired
    };

    componentDidUpdate (prevProps) {
        if (!prevProps.fileDocument.ready && this.props.fileDocument.ready) {
            dispatcher.db.viruses.request("import_file", {file_id: this.props.fileId, replace: this.props.replace})
                .update((data) => this.setState(data))
                .success((data) => this.setState(data))
                .failure((data) => console.warn(data));
        }
    }

    render () {

        let progress;
        let progressText;

        if (this.props.fileDocument.ready) {
            progress = this.state.progress * 100;
            progressText = "Updating database";
        } else {
            const sizeNow = this.props.fileDocument.size_now;
            const sizeEnd = this.props.fileDocument.size_end;

            progress = sizeNow / sizeEnd * 100;
            progressText = `Uploading (${byteSize(sizeNow)}/${byteSize(sizeEnd)})`;
        }

        const warningComponents = this.state.warnings.map((error, index) =>
            <Alert key={index} bsStyle="warning">
                <Flex alignItems="center">
                    <Icon name="warning" />
                    <FlexItem pad={5}>
                        {error}
                    </FlexItem>
                </Flex>
            </Alert>
        );

        const counterComponents = ["added", "replaced", "skipped"].map((key, index) =>
            <ListGroupItem key={index}>
                <span>{capitalize(key)}</span>
                <strong className="pull-right">{this.state[key]}</strong>
            </ListGroupItem>
        );

        return (
            <div>
                {warningComponents}

                <div style={{marginBottom: "15px"}}>
                    <ProgressBar now={progress} />
                    <div className="text-center">
                        <small>{progressText}</small>
                    </div>
                </div>

                <ListGroup>
                    {counterComponents}
                </ListGroup>
            </div>
        );
    }
}
