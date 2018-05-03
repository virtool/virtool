import React from "react";
import { get } from "lodash-es";
import { connect } from "react-redux";
import { Panel } from "react-bootstrap";

import { getSoftwareUpdates } from "../../updates/actions";
import { Icon, LoadingPlaceholder } from "../../base";

class Welcome extends React.Component {

    componentDidMount () {
        this.props.onGet();
    }

    render () {
        let content;

        if (this.props.version) {
            content = (
                <Panel>
                    <Panel.Body>
                        <h3>Virtool <small className="text-muted">{this.props.version}</small></h3>
                        <p>Viral infection diagnostics using next-generation sequencing</p>

                        <a
                            className="btn btn-default"
                            href="http://www.virtool.ca/"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Icon name="globe" /> Website
                        </a>
                    </Panel.Body>
                </Panel>
            );
        } else {
            content = (
                <Panel>
                    <Panel.Body>
                        <LoadingPlaceholder margin="0" />
                    </Panel.Body>
                </Panel>
            );
        }

        return (
            <div className="container">
                {content}
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    version: get(state.updates.software, "current_version")
});

const mapDispatchToProps = (dispatch) => ({

    onGet: () => {
        dispatch(getSoftwareUpdates());
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(Welcome);
