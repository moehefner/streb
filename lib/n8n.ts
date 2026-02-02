/**
 * n8n API client
 * Uncomment and configure when ready to use n8n
 */

// export const n8nClient = {
//   baseUrl: process.env.N8N_API_URL!,
//   apiKey: process.env.N8N_API_KEY!,
  
//   async executeWorkflow(workflowId: string, data: any) {
//     const response = await fetch(`${this.baseUrl}/webhook/${workflowId}`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'X-N8N-API-KEY': this.apiKey,
//       },
//       body: JSON.stringify(data),
//     });
    
//     if (!response.ok) {
//       throw new Error(`n8n workflow execution failed: ${response.statusText}`);
//     }
    
//     return response.json();
//   },
// };

export {};
