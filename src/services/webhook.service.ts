import { prisma } from '../config/database';
import { QueueService } from './queue.service';
import { RealtimeService } from './websocket';
import { logger } from '../utils/logger';

/**
 * Supported webhook event types.
 */
export type WebhookEvent =
  | 'task.created'
  | 'task.updated'
  | 'task.deleted'
  | 'task.status_changed'
  | 'comment.created'
  | 'project.created'
  | 'project.updated'
  | 'member.joined'
  | 'member.removed';

interface EventContext {
  organizationId: string;
  projectId?: string;
  actorId: string;
}

/**
 * WebhookService dispatches domain events to:
 * 1. Registered webhook endpoints (via BullMQ queue)
 * 2. WebSocket rooms (real-time)
 * 3. Analytics tracking
 */
export class WebhookService {
  /**
   * Dispatch a domain event — fan out to all registered webhook endpoints
   * for this organization that subscribe to this event type.
   */
  static async dispatch(
    event: WebhookEvent,
    payload: Record<string, any>,
    context: EventContext
  ): Promise<void> {
    const { organizationId, projectId, actorId } = context;

    logger.debug('Dispatching event', { event, organizationId, projectId });

    // 1. Find all active webhooks that subscribe to this event
    const webhooks = await prisma.webhook.findMany({
      where: {
        organizationId,
        active: true,
        events: { has: event },
      },
    });

    // 2. Queue webhook deliveries
    const envelopeBase = {
      event,
      timestamp: new Date().toISOString(),
      organization: { id: organizationId },
      actor: { id: actorId },
      data: payload,
    };

    for (const webhook of webhooks) {
      await QueueService.dispatchWebhook({
        webhookId: webhook.id,
        event,
        payload: envelopeBase,
        url: webhook.url,
        secret: webhook.secret,
      });
    }

    // 3. Emit real-time event via WebSocket
    if (projectId) {
      RealtimeService.emitToProject(projectId, event, {
        ...envelopeBase,
        projectId,
      });
    }
    RealtimeService.emitToOrg(organizationId, event, envelopeBase);

    // 4. Track analytics
    await QueueService.trackAnalytics({
      event,
      orgId: organizationId,
      metadata: { projectId, actorId, payloadKeys: Object.keys(payload) },
      timestamp: new Date().toISOString(),
    });

    logger.debug('Event dispatched', {
      event,
      webhookCount: webhooks.length,
      organizationId,
    });
  }

  /**
   * Dispatch task-related events with common payload structure
   */
  static async dispatchTaskEvent(
    event: WebhookEvent,
    task: {
      id: string;
      number: number;
      title: string;
      status: string;
      priority: string;
      projectId: string;
    },
    context: EventContext & { changes?: Record<string, { from: any; to: any }> }
  ): Promise<void> {
    const payload: Record<string, any> = {
      task: {
        id: task.id,
        number: task.number,
        title: task.title,
        status: task.status,
        priority: task.priority,
        projectId: task.projectId,
      },
    };

    if (context.changes) {
      payload.changes = context.changes;
    }

    await this.dispatch(event, payload, {
      organizationId: context.organizationId,
      projectId: task.projectId,
      actorId: context.actorId,
    });

    // Send notifications to assignees for important events
    if (['task.created', 'task.status_changed'].includes(event)) {
      await this.notifyTaskAssignees(task.id, event, task.title, context.actorId);
    }
  }

  /**
   * Notify assigned users about task changes
   */
  private static async notifyTaskAssignees(
    taskId: string,
    event: string,
    taskTitle: string,
    actorId: string
  ): Promise<void> {
    try {
      const assignments = await prisma.taskAssignment.findMany({
        where: { taskId },
        select: { userId: true },
      });

      const eventLabels: Record<string, string> = {
        'task.created': 'You have been assigned a new task',
        'task.status_changed': 'Task status updated',
      };

      for (const { userId } of assignments) {
        // Don't notify the actor themselves
        if (userId === actorId) continue;

        await QueueService.createNotification({
          userId,
          type: event,
          title: eventLabels[event] || 'Task updated',
          body: taskTitle,
          metadata: { taskId },
        });
      }
    } catch (error) {
      logger.error('Failed to notify task assignees', { taskId, error });
    }
  }

  /**
   * Dispatch comment events
   */
  static async dispatchCommentEvent(
    comment: { id: string; content: string; taskId: string; authorId: string },
    context: EventContext
  ): Promise<void> {
    await this.dispatch(
      'comment.created',
      {
        comment: {
          id: comment.id,
          content: comment.content.slice(0, 500),
          taskId: comment.taskId,
          authorId: comment.authorId,
        },
      },
      context
    );
  }

  /**
   * Dispatch project events
   */
  static async dispatchProjectEvent(
    event: 'project.created' | 'project.updated',
    project: { id: string; name: string; key: string },
    context: EventContext
  ): Promise<void> {
    await this.dispatch(
      event,
      { project: { id: project.id, name: project.name, key: project.key } },
      {
        ...context,
        projectId: project.id,
      }
    );
  }

  /**
   * Dispatch membership events
   */
  static async dispatchMemberEvent(
    event: 'member.joined' | 'member.removed',
    member: { userId: string; email: string; role: string },
    context: EventContext
  ): Promise<void> {
    await this.dispatch(event, { member }, context);
  }
}
