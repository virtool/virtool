/** Base class for domain errors raised by the data layer. */
export class AppError extends Error {
	constructor(message?: string, options?: ErrorOptions) {
		super(message, options);
		this.name = new.target.name;
	}
}
