export interface VoxFlowInput {
  transcript: string;
  context?: string;
}

export interface VoxFlowOutput {
  text: string;
}

export async function processVoxFlowInput(
  input: VoxFlowInput
): Promise<VoxFlowOutput> {
  return {
    text: input.transcript
  };
}