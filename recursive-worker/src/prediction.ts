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

export function generatePredictions({
	history,
	depth,
	messageBreadth,
	branchPath
}: {
	history: MessageHistory;
	depth: number;
	messageBreadth: number;
	branchPath: number[];
}): BranchPrediction[] {
	const predictions: BranchPrediction[] = [];
	for (let index = 0; index < messageBreadth; index += 1) {
		const nextPath = [...branchPath, index];
		const message = createTreeMessage(history, depth, nextPath);
		predictions.push({ message, branchPath: nextPath });
	}
	return predictions;
}

function createTreeMessage(history: MessageHistory, depth: number, branchPath: number[]): TreeMessage {
	const parent = history.length ? history[history.length - 1] : undefined;
	const generation = depth + 1;
	const side = parent?.side === "left" ? "right" : "left";
	const angleIndex = branchPath[branchPath.length - 1] % predictionAngles.length;
	const angle = predictionAngles[angleIndex];
	const base = parent?.content ?? "conversation start";
	const optionLabel = branchPath.map((step) => step + 1).join(".");

	return {
		id: crypto.randomUUID(),
		side,
		content: `Depth ${generation} option ${optionLabel} ${angle} from "${base}"`,
		parentId: parent?.id
	};
}
