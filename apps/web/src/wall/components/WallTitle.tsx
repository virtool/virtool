import Logo from "@base/Logo";

type WallTitleProps = {
	subtitle: string;
	title: string;
};

export function WallTitle({ subtitle, title }: WallTitleProps) {
	return (
		<>
			<header className="flex items-center justify-center mb-10">
				<Logo className="m-0" color="black" height={60} />
				<h1 className="font-bold m-0">Virtool</h1>
			</header>
			<header className="mb-6">
				<h2 className="font-bold text-2xl mb-2">{title}</h2>
				<p className="font-medium text-lg text-gray-600">{subtitle}</p>
			</header>
		</>
	);
}
