import type { MessageHistory, TreeMessage } from "../../packages/types/src";

const predictionAngles = [
	"highlights a concrete next step",
	"amplifies the emotional payoff",
	"frames the idea as a bold statement",
	"turns the concept into a question to provoke thought",
	"adds a vivid sensory detail to make it memorable"
];

export interface BranchPrediction {
	message: TreeMessage;
	branchPath: number[];
}

export async function generatePredictions({
	history,
	depth,
	messageBreadth,
	branchPath,
	ai
}: {
	history: MessageHistory;
	depth: number;
	messageBreadth: number;
	branchPath: number[];
	ai: Ai;
}): Promise<BranchPrediction[]> {
	const predictionPromises: Promise<BranchPrediction>[] = [];
	for (let index = 0; index < messageBreadth; index += 1) {
		const nextPath = [...branchPath, index];
		predictionPromises.push(
			createTreeMessage(history, depth, nextPath, ai).then((message) => ({
				message,
				branchPath: nextPath
			}))
		);
	}
	return Promise.all(predictionPromises);
}

async function createTreeMessage(history: MessageHistory, depth: number, branchPath: number[], ai: Ai): Promise<TreeMessage | null> {
	const parent = history.length ? history[history.length - 1] : undefined;
	const generation = depth + 1;

	const angleIndex = branchPath[branchPath.length - 1] % predictionAngles.length;
	const angle = predictionAngles[angleIndex];
	const optionLabel = branchPath.map((step) => step + 1).join(".");

	const systemPrompt = `Provide a creative continuation of the following conversation snippet. The response should reflect the style and tone of the conversation so far, while incorporating the specified angle to enhance the message. Keep the response concise and engaging. The angle is ${angle}.`;

	const response = await ai.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
		messages: [
			{ role: "system", content: systemPrompt },
			...history.map((msg) => ({
				role: "user",
				content: `${msg.side}: ${msg.content}`
			})),
		]
	});

	console.log(response, typeof response);

	// {
	// 	response: "right: Actually, I was thinking we could grab a cup of coffee and discuss the project that's been on hold. How about we meet at the café down the street at 2 PM today and outline a plan to move it forward?",
	// 	tool_calls: [],
	// 	usage: { prompt_tokens: 132, completion_tokens: 49, total_tokens: 181 }
	// }

	let side: "left" | "right";
	if (response.response.startsWith("left:")) {
		side = "left";
	} else if (response.response.startsWith("right:")) {
		side = "right";
	} else {
		// No side, don't return
		console.warn("AI response missing side prefix:", response.response);
		return null
	}

	return {
		id: crypto.randomUUID(),
		side,
		content: response.response.slice(side.length + 2).trim(),
		parentId: parent?.id
	};
}
