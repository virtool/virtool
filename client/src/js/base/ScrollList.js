import React from "react";
import { map } from "lodash-es";
import { Button } from "react-bootstrap";
import { LoadingPlaceholder } from "./index";

export class ScrollList extends React.Component {

    componentDidMount () {
        window.addEventListener("scroll", this.onScroll, false);
    }

    componentWillUnmount () {
        window.removeEventListener("scroll", this.onScroll, false);
    }

    onScroll = () => {
        // Scroll bar reaches the bottom of page when ratio = 1
        // Want to load available page when scroll bar nears the bottom
        const ratio = ((window.innerHeight + window.scrollY) / document.body.scrollHeight).toFixed(1);

        if (this.props.list.length
            && this.props.hasNextPage
            && !this.props.isNextPageLoading
            && (ratio > 0.8)
        ) {
            this.props.loadNextPage(this.props.page + 1);
        }
    };

    loadMore = () => {
        this.props.loadNextPage(this.props.page + 1);
    };

    render () {
        const { list, rowRenderer, isNextPageLoading, hasNextPage, errorLoad } = this.props;

        let loadMoreButton;

        const contentHeight = (document.body.clientHeight < window.innerHeight)
            ? document.body.clientHeight : document.body.scrollHeight;

        // List is shorter than UI page (therefore no scrollbars to auto-load) or
        // request for next page failed.
        if ((contentHeight <= (window.innerHeight + window.scrollY) && (hasNextPage && !isNextPageLoading)) 
            || errorLoad) {
            loadMoreButton = (
                <Button bsStyle="primary" onClick={this.loadMore} block>
                    Load More
                </Button>
            );
        }

        return (
            <div>
                {map(list, (item, index) => rowRenderer(index))}
                {(isNextPageLoading && hasNextPage) ? <LoadingPlaceholder margin="20px" /> : null}
                {loadMoreButton || null}
            </div>
        );
    }
}
