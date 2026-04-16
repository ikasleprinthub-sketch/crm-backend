import * as leadService from "./lead.service";

export const createLead = async (req: any, res: any) => {
  try {
    const lead = await leadService.createLead(req.body);
    res.json(lead);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const getLeads = async (req: any, res: any) => {
  const leads = await leadService.getLeads();
  res.json(leads);
};

export const getLead = async (req: any, res: any) => {
  const lead = await leadService.getLeadById(req.params.id);
  res.json(lead);
};

export const updateLead = async (req: any, res: any) => {
  const lead = await leadService.updateLead(req.params.id, req.body);
  res.json(lead);
};

export const deleteLead = async (req: any, res: any) => {
  await leadService.deleteLead(req.params.id);
  res.json({ message: "Deleted" });
};

// 🔥 CONVERT API
export const convertLead = async (req: any, res: any) => {
  try {
    const task = await leadService.convertLeadToTask(
      req.params.id,
      req.user
    );
    res.json(task);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};
