import React from "react";
import { map } from "lodash-es";
import { LoadingPlaceholder } from "./index";

export const getScrollRatio = () =>
    ((window.innerHeight + window.scrollY) / document.documentElement.scrollHeight).toFixed(1);

export class ScrollList extends React.Component {
    componentDidMount() {
        window.addEventListener("scroll", this.onScroll);
    }

    componentWillUnmount() {
        window.removeEventListener("scroll", this.onScroll);
    }

    onScroll = () => {
        if (this.props.documents.length && this.props.page < this.props.pageCount && getScrollRatio() > 0.8) {
            this.props.onLoadNextPage(this.props.page + 1);
        }
    };

    render() {
        const { documents, renderRow, page, pageCount } = this.props;

        const entries = map(documents, (item, index) => renderRow(index));

        let loading;

        if (documents === null && page < pageCount) {
            loading = <LoadingPlaceholder margin="20px" />;
        }

        return (
            <div style={this.props.style}>
                {entries}
                {loading}
            </div>
        );
    }
}
