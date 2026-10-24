import { StructuredTool } from "@langchain/core/tools";
import { webSearchTool } from "./web-search.js";

export class ToolRegistry {
  private readonly tools = new Map<string, StructuredTool>();

  constructor() {
    this.register(webSearchTool);
  }

  register(toolInstance: StructuredTool): void {
    this.tools.set(toolInstance.name, toolInstance);
  }

  get(name: string): StructuredTool | undefined {
    return this.tools.get(name);
  }

  getAll(): StructuredTool[] {
    return Array.from(this.tools.values());
  }
}

export const defaultToolRegistry = new ToolRegistry();
