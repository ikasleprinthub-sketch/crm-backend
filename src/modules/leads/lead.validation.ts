export const validateCreateLead = (data: any) => {
  const requiredFields = [
    "sourceId",
    "leadName",
    "departmentId",
    "taskTypeId",
  ];

  for (let field of requiredFields) {
    if (!data[field]) {
      throw new Error(`${field} is required`);
    }
  }
};
