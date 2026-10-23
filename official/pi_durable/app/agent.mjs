// A chat assistant on pi-durable. Every message, model turn and tool call is stored in SQLite before it is shown,
// so stopping the process mid-answer loses nothing: the next start resumes the unfinished run.
import { createInterface } from "node:readline/promises";
import { BACKGROUND_CONTEXT as context } from "@earendil-works/chord/context";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { createModels, createProvider } from "@earendil-works/pi-ai/models";
import { createRegistry, defineExtension, Harness, section } from "@earendil-works/pi-durable";
import { NodeExecutionEnv } from "@earendil-works/pi-durable/env/node";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";
import { CodingTools } from "@earendil-works/pi-durable/tools";

const DB = process.env.AGENT_DB ?? "/data/agent.sqlite";
const WORKSPACE = process.env.AGENT_WORKSPACE ?? "/data/work";
// Any OpenAI-compatible chat completions API; the default is OpenCode Go.
const BASE_URL = process.env.OPENAI_BASE_URL ?? "https://opencode.ai/inference/go/v1";
const MODEL = { provider: "openai-compatible", modelId: process.env.AGENT_MODEL || "deepseek-v4.1-flash" };

const models = createModels();
models.setProvider(
	createProvider({
		id: MODEL.provider,
		baseUrl: BASE_URL,
		auth: {
			apiKey: {
				name: "OPENAI_API_KEY",
				resolve: async () =>
					process.env.OPENAI_API_KEY ? { auth: { apiKey: process.env.OPENAI_API_KEY }, source: "OPENAI_API_KEY" } : undefined,
			},
		},
		models: [
			{
				id: MODEL.modelId,
				name: MODEL.modelId,
				api: "openai-completions",
				provider: MODEL.provider,
				baseUrl: BASE_URL,
				reasoning: false,
				input: ["text"],
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				// ponytail: fixed limits for any model; raise them for long sessions on a model with a bigger window.
				contextWindow: 128_000,
				maxTokens: 16_384,
			},
		],
		api: openAICompletionsApi(),
	}),
);

const registry = createRegistry();
registry.install(CodingTools); // read, write, edit, bash
registry.install(
	defineExtension({
		name: "assistant",
		sections: [
			section("preamble", () => "You are a helpful assistant with a Linux workspace. Use the tools to get work done.", {
				tag: false,
			}),
			section("cwd", (input) => input.env?.cwd),
		],
	}),
);

const harness = await Harness.open(
	await openNodeSqliteStorage(DB),
	{ models, registry, env: ({ cwd = WORKSPACE }) => new NodeExecutionEnv({ cwd }) },
	context,
);
const chat = await harness.root(context, { agent: { model: MODEL, cwd: WORKSPACE } });

// Print every committed entry once: the stored history on start, then each new one, including a resumed run's.
const printed = new Set();
let typed = false; // the user's own lines are already on screen
const print = (message) => {
	if (message.role === "user") {
		if (!typed) console.log(`> ${typeof message.content === "string" ? message.content : "[input]"}`);
		return;
	}
	if (message.role === "toolResult") {
		const text = message.content.find((block) => block.type === "text")?.text ?? "";
		console.log(`  ${message.isError ? "[failed]" : "->"} ${text.trim().split("\n")[0].slice(0, 120)}`);
		return;
	}
	for (const block of message.content) {
		if (block.type === "text") console.log(block.text);
		if (block.type === "toolCall") console.log(`  [${block.name}] ${JSON.stringify(block.arguments).slice(0, 120)}`);
	}
	if (message.stopReason === "error") console.log(`  [error] ${message.errorMessage}`);
};
(await chat.viewState(context)).subscribe((view) => {
	for (const entry of view.entries) {
		if (printed.has(entry.id)) continue;
		printed.add(entry.id);
		for (const message of entry.model ?? []) print(message);
	}
});
harness.resume(); // continue whatever the last process left unfinished

const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "> " });
rl.prompt();
for await (const line of rl) {
	if (line.trim() !== "") {
		typed = true;
		const submission = await chat.submit({ type: "input", content: line.trim() }, context);
		const settled = await submission.wait(context);
		if (settled.status !== "done") console.log(`  [unanswered] ${settled.reason}`);
	}
	if (!rl.closed) rl.prompt(); // stdin may have ended while the answer ran
}
await harness.close(context);
