import { Router, Request, Response, NextFunction } from 'express';
import Groq from 'groq-sdk';
import { authenticate } from '../middleware/authenticate';

export const chatRouter = Router();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

const SYSTEM_PROMPT = `You are TaskFlow AI Assistant — a helpful assistant for a project management application called TaskFlow. 

TaskFlow features:
- Multi-tenant: Users can create/switch organizations
- Roles: Owner (full control), Admin (manage members/projects/webhooks), Member (create/edit tasks), Viewer (read-only)
- Projects with Kanban boards (Backlog → Todo → In Progress → In Review → Done)
- Tasks with priorities (Urgent, High, Medium, Low), labels, assignees, sprints
- Comments on tasks (threaded)
- Webhooks for external integrations
- Real-time updates via WebSocket
- Light/Dark mode

Be concise, helpful, and friendly. If asked about features that don't exist, suggest alternatives within the app. Help users navigate the app and explain how things work.`;

chatRouter.use(authenticate);

chatRouter.post(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { messages } = req.body;

      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ success: false, error: { message: 'messages array required' } });
        return;
      }

      const completion = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages.slice(-10), // Last 10 messages for context
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const reply = completion.choices[0]?.message?.content || "I couldn't generate a response. Please try again.";

      res.json({ success: true, data: { reply } });
    } catch (error: any) {
      console.error('Groq API error:', error.message);
      res.status(500).json({ success: false, error: { message: 'AI service unavailable' } });
    }
  }
);
