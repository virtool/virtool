import React from "react";
import URI from "urijs";
import { Route } from "react-router-dom";
import { push } from "react-router-redux";
import { connect } from "react-redux";
import { Badge, ListGroup, Pagination } from "react-bootstrap";

import { findSamples } from "../actions";
import { Flex, FlexItem, Icon, ListGroupItem } from "../../base";
import SampleEntry from "./Entry";
import SampleToolbar from "./Toolbar";
import CreateSample from "./Create/Create";
import QuickAnalyze from "./QuickAnalyze";

class SamplesList extends React.Component {

    componentDidMount () {
        this.props.onFind(this.props.location);
    }

    componentDidUpdate (prevProps) {
        if (prevProps.location !== this.props.location) {
            this.props.onFind(this.props.location);
        }
    }

    handleTermChange = (value) => {
        const url = new URI(this.props.location.pathname + this.props.location.search);

        if (value) {
            url.setSearch("find", value);
        } else {
            url.removeSearch("find");
        }

        this.props.history.push(url.toString());
    };

    handleSelect = (eventKey) => {
        const url = new URI(this.props.location.pathname + this.props.location.search);
        url.setSearch({page: eventKey});

        this.props.history.push(url.toString());
    };

    render () {

        if (this.props.samples === null) {
            return <div />;
        }

        const term = this.props.match.params.term;

        const samplesCount = this.props.samples.length;

        let sampleComponents;

        if (samplesCount) {
            sampleComponents = this.props.samples.map(document =>
                <SampleEntry
                    key={document.id}
                    id={document.id}
                    userId={document.user.id}
                    {...document}
                />
            );
        } else {
            sampleComponents = (
                <ListGroupItem key="noSample" className="text-center">
                    <Icon name="info"/> No samples found.
                </ListGroupItem>
            );
        }

        const first = 1 + (this.props.page - 1) * 15;
        const last = first + (samplesCount < 15 ? samplesCount - 1: 14);

        return (
            <div>
                <h3 className="view-header">
                    <Flex alignItems="flex-end">
                        <FlexItem grow={1}>
                            <strong>
                                Samples <Badge>{this.props.totalCount}</Badge>
                            </strong>
                        </FlexItem>

                        <span className="text-muted pull-right" style={{fontSize: "12px"}}>
                            Viewing {first} - {last} of {this.props.foundCount}
                        </span>
                    </Flex>
                </h3>

                <SampleToolbar
                    term={term}
                    onTermChange={this.handleTermChange}
                    history={this.props.history}
                    location={this.props.location}
                />

                <ListGroup>
                    {sampleComponents}
                </ListGroup>

                <div className="text-center">
                    <Pagination
                        onSelect={this.handleSelect}
                        items={this.props.pageCount}
                        maxButtons={10}
                        activePage={this.props.page}
                        first
                        last
                        next
                        prev
                    />
                </div>

                <Route path="/samples" render={({ history }) =>
                    <CreateSample
                        show={!!(history.location.state && history.location.state.create)}
                        onHide={this.props.onHide}
                    />
                } />

                <Route path="/samples" render={({ history }) =>
                    <QuickAnalyze
                        show={!!(history.location.state && history.location.state.quickAnalyze)}
                        {...(history.location.state ? history.location.state.quickAnalyze: {})}
                        onHide={this.props.onHide}
                    />
                } />
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        term: state.samples.term,
        samples: state.samples.documents,
        totalCount: state.samples.totalCount,
        foundCount: state.samples.foundCount,
        pageCount: state.samples.pageCount,
        page: state.samples.page
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onFind: (location) => {
            const uri = new URI(location.search);
            const query = uri.search(true);

            dispatch(findSamples(query.find, query.page));
        },

        onHide: () => {
            dispatch(push({state: {}}));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(SamplesList);

export default Container;
