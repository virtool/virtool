import React from "react";
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
        this.props.onFind();
    }

    handleTermChange = (value) => {
        const url = new window.URL(window.location);

        if (value) {
            url.searchParams.set("find", value);
        } else {
            url.searchParams.delete("find");
        }

        this.onFind(url);
    };

    handlePage = (page) => {
        const url = new window.URL(window.location);
        url.searchParams.set("page", page);
        this.onFind(url);
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
                    canCreate={this.props.canCreate}
                />

                <ListGroup>
                    {sampleComponents}
                </ListGroup>

                <div className="text-center">
                    <Pagination
                        onSelect={this.handlePage}
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
        canCreate: state.account.permissions.create_sample,
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
        onFind: (url = new window.URL(window.location)) => {
            dispatch(push(url.pathname + url.search));
            dispatch(findSamples(url.searchParams.get("find"), url.searchParams.get("page") || 1));
        },

        onHide: () => {
            dispatch(push({state: {}}));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(SamplesList);

export default Container;
