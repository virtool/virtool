import React from "react";
import { map } from "lodash-es";
import { LoadingPlaceholder } from "./index";

export const getScrollRatio = (innerHeight, scrollY, scrollHeight) =>
    ((innerHeight + scrollY) / scrollHeight).toFixed(1);

export class ScrollList extends React.Component {
    constructor(props) {
        super(props);
        this.scrollList = React.createRef();
    }

    componentDidMount() {
        return this.props.isElement
            ? this.scrollList.current.addEventListener("scroll", this.onScroll)
            : window.addEventListener("scroll", this.onScroll, false);
    }

    componentDidUpdate() {
        if (
            this.props.refetchPage &&
            !this.props.isElement &&
            window.innerHeight === document.documentElement.scrollHeight &&
            this.props.hasNextPage &&
            !this.props.isNextPageLoading
        ) {
            // Reload first page when entry deletion results in
            // loss of scrollbars (list same/shorter than window height)
            this.props.loadNextPage(this.props.page);
        }
    }

    componentWillUnmount() {
        return this.props.isElement
            ? this.scrollList.current.removeEventListener("scroll", this.onScroll)
            : window.removeEventListener("scroll", this.onScroll, false);
    }

    onScroll = () => {
        // Scroll bar reaches the bottom of page when ratio = 1.
        // Want to load available page when scroll bar nears the bottom
        const ratio = this.props.isElement
            ? getScrollRatio(
                  this.scrollList.current.clientHeight,
                  this.scrollList.current.scrollTop,
                  this.scrollList.current.scrollHeight
              )
            : getScrollRatio(window.innerHeight, window.scrollY, document.documentElement.scrollHeight);

        if (this.props.documents.length && this.props.page < this.props.pageCount && ratio > 0.8) {
            // If entry deletion has occurred, must reload latest page
            // to synchronize page entries with database
            this.props.onLoadNextPage(this.props.page + 1);
        }
    };

    render() {
        const { documents, renderRow, isNextPageLoading, page, pageCount, noContainer } = this.props;

        const entries = map(documents, (item, index) => renderRow(index));

        let loading;

        if (isNextPageLoading && page < pageCount) {
            loading = <LoadingPlaceholder margin="20px" />;
        }

        if (noContainer) {
            return (
                <React.Fragment>
                    {entries}
                    {loading}
                </React.Fragment>
            );
        }

        return (
            <div ref={this.scrollList} style={this.props.style}>
                {entries}
                {loading}
            </div>
        );
    }
}
