export interface LinearMessage {
  id: string;
  side: "left" | "right";
  content: string;
}

export interface TreeMessage extends LinearMessage {
  parentId?: string;
}

export type MessageHistory = LinearMessage[];
export type MessagePredictions = TreeMessage[];

export interface PredictionRequest {
  history: MessageHistory;
  messageBreadth: number;
  maxDepth: number;
  depth?: number;
  branchPath?: number[];
}