export const validateLogin = (data: any) => {
  if (!data.email || !data.password) {
    throw new Error("Email and password are required");
  }
};
