"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { canEdit } from '@/components/RoleBadge';
import { useRealtime } from '@/components/RealtimeProvider';
import { joinProject, leaveProject } from '@/lib/socket';

const COLUMNS = [
  { key: 'BACKLOG', label: 'Backlog', color: 'border-gray-400' },
  { key: 'TODO', label: 'To Do', color: 'border-blue-500' },
  { key: 'IN_PROGRESS', label: 'In Progress', color: 'border-yellow-500' },
  { key: 'IN_REVIEW', label: 'In Review', color: 'border-purple-500' },
  { key: 'DONE', label: 'Done', color: 'border-green-500' },
];

export default function TaskBoard() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { currentOrg } = useAuth();
  const { socket, connected, onlineUsers } = useRealtime();
  const editable = currentOrg ? canEdit(currentOrg.role) : false;
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<{ taskId: string; user: { firstName: string } }[]>([]);

  useEffect(() => {
    if (projectId) load();
  }, [projectId]);

  // Join/leave project room for real-time
  useEffect(() => {
    if (connected && projectId) {
      joinProject(projectId);
      return () => { leaveProject(projectId); };
    }
  }, [connected, projectId]);

  // Listen for real-time task events
  useEffect(() => {
    if (!socket) return;

    function handleTaskCreated(data: any) {
      if (data.projectId === projectId && data.data?.task) {
        // Reload to get full task data
        load();
      }
    }

    function handleTaskUpdated(data: any) {
      if (data.projectId === projectId && data.data?.task) {
        const updated = data.data.task;
        setTasks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
      }
    }

    function handleTypingStart(data: { taskId: string; user: { firstName: string } }) {
      setTypingUsers(prev => [...prev.filter(t => t.taskId !== data.taskId), data]);
      setTimeout(() => setTypingUsers(prev => prev.filter(t => t.taskId !== data.taskId)), 3000);
    }

    function handleTypingStop(data: { taskId: string }) {
      setTypingUsers(prev => prev.filter(t => t.taskId !== data.taskId));
    }

    socket.on('task.created', handleTaskCreated);
    socket.on('task.updated', handleTaskUpdated);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);

    return () => {
      socket.off('task.created', handleTaskCreated);
      socket.off('task.updated', handleTaskUpdated);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
    };
  }, [socket, projectId]);

  async function load() {
    try {
      const [pRes, tRes] = await Promise.all([api.get(`/projects/${projectId}`), api.get(`/tasks?projectId=${projectId}&perPage=100`)]);
      setProject(pRes.data.data);
      setTasks(tRes.data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function updateStatus(taskId: string, status: string) {
    await api.patch(`/tasks/${taskId}`, { status });
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
  }

  async function createTask() {
    if (!newTitle.trim()) return;
    const res = await api.post('/tasks', { title: newTitle.trim(), projectId, status: 'TODO' });
    setTasks(prev => [...prev, res.data.data]);
    setNewTitle('');
    setShowCreate(false);
  }

  if (loading) return <div className="p-8 text-muted-foreground">Loading board...</div>;

  return (
    <div className="p-6 h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{project?.name}</h1>
          <p className="text-muted-foreground text-sm">
            <span className="font-mono text-primary">{project?.key}</span> · {tasks.length} tasks
            {connected && <span className="ml-2 text-green-500 text-xs">● Live</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Online users */}
          {onlineUsers.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">{onlineUsers.length} online</span>
              <div className="flex -space-x-1">
                {onlineUsers.slice(0, 3).map(uid => (
                  <div key={uid} className="w-6 h-6 bg-green-500 rounded-full border-2 border-background flex items-center justify-center text-[9px] text-white font-bold">
                    ●
                  </div>
                ))}
              </div>
            </div>
          )}
          {editable && <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 transition-all">+ Add Task</button>}
        </div>
      </div>

      {/* Quick Create */}
      {showCreate && (
        <div className="mb-4 flex gap-2">
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Task title..."
            className="flex-1 px-3 py-2 bg-accent border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus onKeyDown={(e) => { if (e.key === 'Enter') createTask(); if (e.key === 'Escape') setShowCreate(false); }} />
          <button onClick={createTask} className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-xl">Add</button>
          <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-accent border border-border text-foreground text-sm rounded-xl">Cancel</button>
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.key);
          return (
            <div key={col.key} className="flex-shrink-0 w-72 flex flex-col"
              onDragOver={(e) => editable && e.preventDefault()} onDrop={() => { if (editable && draggedTask) { updateStatus(draggedTask, col.key); setDraggedTask(null); } }}>
              <div className={`flex items-center gap-2 mb-3 pb-2 border-b-2 ${col.color}`}>
                <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                <span className="text-xs text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{colTasks.length}</span>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto">
                {colTasks.map(task => (
                  <div key={task.id} draggable={editable} onDragStart={() => editable && setDraggedTask(task.id)}
                    className={`p-3 bg-accent border border-border rounded-xl transition-all ${editable ? 'cursor-grab hover:border-primary/50 active:cursor-grabbing' : ''} ${draggedTask === task.id ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-muted-foreground font-mono">{project?.key}-{task.number}</span>
                      <span className={`text-xs ${prColor(task.priority)}`}>● {task.priority}</span>
                    </div>
                    <p className="text-sm text-foreground">{task.title}</p>
                    {/* Typing indicator */}
                    {typingUsers.find(t => t.taskId === task.id) && (
                      <p className="text-[10px] text-muted-foreground mt-1 italic">
                        {typingUsers.find(t => t.taskId === task.id)?.user.firstName} is typing...
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function prColor(p: string) {
  return { URGENT: 'text-red-500', HIGH: 'text-orange-500', MEDIUM: 'text-blue-500', LOW: 'text-green-500' }[p] || 'text-muted-foreground';
}
