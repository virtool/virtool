import PropTypes from "prop-types";
import React from "react";
import { Button } from "react-bootstrap";
import styled from "styled-components";
import { BoxGroupSection, Icon } from "../../base";
import { ReleaseMarkdown } from "./Markdown";

const ReleaseName = styled.span`
    cursor: pointer;
    flex: 2 0 auto;
`;

const ReleaseHeader = styled.div`
    align-items: center;
    display: flex;
`;

export default class Release extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            in: false
        };
    }

    static propTypes = {
        name: PropTypes.string.isRequired,
        body: PropTypes.string.isRequired,
        html_url: PropTypes.string.isRequired
    };

    handleClick = () => {
        this.setState({
            in: !this.state.in
        });
    };

    render() {
        const caret = <Icon className="fixed-width" name={`caret-${this.state.in ? "down" : "right"}`} />;

        let markdown;

        if (this.state.in) {
            markdown = <ReleaseMarkdown body={this.props.body} />;
        }

        return (
            <BoxGroupSection>
                <ReleaseHeader>
                    <ReleaseName onClick={this.handleClick}>
                        {caret} <strong>{this.props.name}</strong>
                    </ReleaseName>
                    <Button bsSize="xsmall" target="_blank" href={this.props.html_url}>
                        <i className="fab fa-github" /> GitHub
                    </Button>
                </ReleaseHeader>

                {markdown}
            </BoxGroupSection>
        );
    }
}
