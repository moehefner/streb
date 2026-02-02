// Common TypeScript types for the application

export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: Date;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
}

export interface Workflow {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  n8nWorkflowId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
