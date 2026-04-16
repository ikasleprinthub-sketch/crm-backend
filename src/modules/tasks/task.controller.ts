import * as taskService from "./task.service";

export const createTask = async (req: any, res: any) => {
  try {
    const task = await taskService.createTask(req.body, req.user);
    res.json(task);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const getTasks = async (req: any, res: any) => {
  const tasks = await taskService.getTasks(req.user);
  res.json(tasks);
};

export const updateStatus = async (req: any, res: any) => {
  try {
    const task = await taskService.updateTaskStatus(
      req.params.id,
      req.body.status,
      req.user
    );
    res.json(task);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const assignTask = async (req: any, res: any) => {
  try {
    const task = await taskService.assignTask(
      req.params.id,
      req.body.assignedToId,
      req.user
    );
    res.json(task);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const updateSOP = async (req: any, res: any) => {
  const step = await taskService.updateSOPStep(req.params.stepId);
  res.json(step);
};
