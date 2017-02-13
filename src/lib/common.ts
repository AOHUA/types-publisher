import * as fsp from "fs-promise";

import { readJson, writeJson } from "../util/io";
import { joinPaths } from "../util/util";
import { typesDirectoryName } from "../lib/settings";

if (process.env.LONGJOHN) {
	console.log("=== USING LONGJOHN ===");
	const longjohn = require("longjohn");
	longjohn.async_trace_limit = -1; // unlimited
}

export const home = joinPaths(__dirname, "..", "..");

/** Settings that may be determined dynamically. */
export class Options {
	/** Options for running locally. */
	static defaults = new Options("../DefinitelyTyped", true);
	static azure = new Options("../DefinitelyTyped", false);

	/** Location of all types packages. This is a subdirectory of DefinitelyTyped. */
	readonly typesPath: string;
	constructor(
		/** e.g. '../DefinitelyTyped'
		 * This is overridden to `cwd` when running the tester, as that is run from within DefinitelyTyped.
		 */
		readonly definitelyTypedPath: string,
		/** Whether to show progress bars. Good when running locally, bad when running on travis / azure. */
		readonly progress: boolean) {

		this.typesPath = joinPaths(definitelyTypedPath, typesDirectoryName);
	}
}

export function readDataFile(generatedBy: string, fileName: string): Promise<any> {
	return readFileAndWarn(generatedBy, dataFilePath(fileName));
}

/** If a file doesn't exist, warn and tell the step it should have bene generated by. */
export async function readFileAndWarn(generatedBy: string, filePath: string): Promise<any> {
	try {
		return await readJson(filePath);
	} catch (e) {
		console.error(`Run ${generatedBy} first!`);
		throw e;
	}
}

export async function writeDataFile(filename: string, content: {}, formatted = true) {
	await fsp.ensureDir(dataDir);
	await writeJson(dataFilePath(filename), content, formatted);
}

const dataDir = joinPaths(home, "data");
function dataFilePath(filename: string) {
	return joinPaths(dataDir, filename);
}
