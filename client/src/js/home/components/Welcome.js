import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Icon, Panel } from "../../base";

const Welcome = props => {
    let version;

    if (props.version) {
        version = <small className="text-muted">{props.version}</small>;
    }
    return (
        <div className="container">
            <Panel>
                <Panel.Body>
                    <h3>Virtool {version}</h3>
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
        </div>
    );
};

const mapStateToProps = state => ({
    version: get(state.updates, "version")
});

export default connect(
    mapStateToProps,
    null
)(Welcome);
