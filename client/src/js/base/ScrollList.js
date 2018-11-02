import React from "react";
import { map } from "lodash-es";
import { LoadingPlaceholder } from "./index";

export const calculateScrollRatio = (innerHeight, scrollY, scrollHeight) =>
    ((innerHeight + scrollY) / scrollHeight).toFixed(1);

export class ScrollList extends React.Component {
    constructor(props) {
        super(props);
        this.scrollList = React.createRef();
    }

    componentDidMount() {
        this.getEventTarget().addEventListener("scroll", this.onScroll);
    }

    componentWillUnmount() {
        this.getEventTarget().removeEventListener("scroll", this.onScroll);
    }

    getEventTarget = () => (this.props.isElement ? this.scrollList.current : window);

    getScrollRatio = () => {
        if (this.props.isElement) {
            return calculateScrollRatio(
                this.scrollList.current.clientHeight,
                this.scrollList.current.scrollTop,
                this.scrollList.current.scrollHeight
            );
        }

        return calculateScrollRatio(window.innerHeight, window.scrollY, document.documentElement.scrollHeight);
    };

    onScroll = () => {
        if (this.props.documents.length && this.props.page < this.props.pageCount && this.getScrollRatio() > 0.8) {
            this.props.onLoadNextPage(this.props.page + 1);
        }
    };

    render() {
        const { documents, renderRow, page, pageCount, noContainer } = this.props;

        const entries = map(documents, (item, index) => renderRow(index));

        let loading;

        if (documents === null && page < pageCount) {
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
