import { Router } from 'express';
import { authRouter } from './auth.routes';
import { organizationRouter } from './organization.routes';
import { projectRouter } from './project.routes';
import { taskRouter } from './task.routes';
import { commentRouter } from './comment.routes';
import { webhookRouter } from './webhook.routes';
import { notificationRouter } from './notification.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/organizations', organizationRouter);
apiRouter.use('/projects', projectRouter);
apiRouter.use('/tasks', taskRouter);
apiRouter.use('/comments', commentRouter);
apiRouter.use('/webhooks', webhookRouter);
apiRouter.use('/notifications', notificationRouter);
