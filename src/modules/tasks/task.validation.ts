export const validateCreateTask = (data: any) => {
  const requiredFields = ["leadId", "departmentId", "taskTypeId", "assignedToId"];

  for (let field of requiredFields) {
    if (!data[field]) {
      throw new Error(`${field} is required`);
    }
  }
};
