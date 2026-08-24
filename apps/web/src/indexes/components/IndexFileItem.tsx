import { byteSize } from "@app/format";
import { BoxGroupSection } from "@base/Box";

export type IndexFileItemProps = {
	downloadUrl: string;
	name: string;
	size: number;
};

export function IndexFileItem({ downloadUrl, name, size }: IndexFileItemProps) {
	return (
		<BoxGroupSection className="flex items-center">
			<a className="mr-auto font-medium" href={downloadUrl}>
				{name}
			</a>
			<strong>{byteSize(size)}</strong>
		</BoxGroupSection>
	);
}
