/** Base class for domain errors raised by the data layer. */
export class AppError extends Error {
	constructor(message?: string) {
		super(message);
		this.name = new.target.name;
	}
}
